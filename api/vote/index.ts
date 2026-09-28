import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { isValidEmail, normalizeEmail } from './email';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const votesTable = TableClient.fromConnectionString(connectionString, 'votes');
const countsTable = TableClient.fromConnectionString(connectionString, 'votecounts');

// Comma-separated list of site origins allowed to call the API. More than one
// lets the site be served from a second host (a staging domain, or localhost)
// without redeploying. The first entry is echoed to origins not on the list.
//
// These headers only cover actual requests. In Azure the Functions host answers
// browser preflights itself, before this code runs, from the Function App's
// platform CORS setting (`az functionapp cors`), which must list the same origins.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://products.cse-icon.com')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(req: HttpRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

/** A product slug as the site sends it: the product's folder name. */
const PRODUCT_SLUG = /^[a-z0-9-]{1,40}$/;

async function ensureTables() {
  await votesTable.createTable().catch(() => {});
  await countsTable.createTable().catch(() => {});
}

// POST /api/vote — submit a vote (immediate, no email confirmation)
async function postVote(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  await ensureTables();
  const headers = corsHeaders(req);

  let body: { itemId?: string; email?: string; useCase?: string; product?: string };
  try {
    body = (await req.json()) as {
      itemId?: string;
      email?: string;
      useCase?: string;
      product?: string;
    };
  } catch {
    return { status: 400, headers, jsonBody: { error: 'Invalid JSON body' } };
  }

  const { itemId, email, useCase, product } = body;

  if (!itemId || !email || !isValidEmail(email)) {
    return { status: 400, headers, jsonBody: { error: 'Valid itemId and email are required' } };
  }

  const normalized = normalizeEmail(email);

  // Check if this normalized email already voted for this item
  try {
    const existing = await votesTable.getEntity(itemId, normalized);
    if (existing) {
      return { status: 409, headers, jsonBody: { error: 'You have already voted for this item.' } };
    }
  } catch (err: any) {
    if (err.statusCode !== 404) {
      context.error('Error checking existing vote:', err);
      return { status: 500, headers, jsonBody: { error: 'Internal server error' } };
    }
  }

  // Record the vote immediately
  await votesTable.createEntity({
    partitionKey: itemId,
    rowKey: normalized,
    originalEmail: email.trim().toLowerCase(),
    useCase: useCase || '',
    // Which product page the vote came from. Item IDs are globally unique
    // GitHub Project node IDs, so this is for segmentation, not for keying.
    // Anything that is not a slug is dropped rather than stored.
    product: typeof product === 'string' && PRODUCT_SLUG.test(product) ? product : '',
    timestamp: new Date().toISOString(),
  });

  // Increment vote count
  try {
    const countEntity = await countsTable.getEntity('counts', itemId);
    const currentCount = (countEntity.count as number) || 0;
    await countsTable.updateEntity(
      { partitionKey: 'counts', rowKey: itemId, count: currentCount + 1 },
      'Merge',
    );
  } catch (err: any) {
    if (err.statusCode === 404) {
      await countsTable.createEntity({ partitionKey: 'counts', rowKey: itemId, count: 1 });
    } else {
      context.error('Error updating vote count:', err);
    }
  }

  return {
    status: 200,
    headers,
    jsonBody: { message: 'Vote recorded. Thanks for your feedback!' },
  };
}

// GET /api/vote/{itemId} — get vote count
async function getVoteCount(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  await ensureTables();
  const headers = corsHeaders(req);

  const itemId = req.params.itemId;
  if (!itemId) {
    return { status: 400, headers, jsonBody: { error: 'itemId is required' } };
  }

  try {
    const countEntity = await countsTable.getEntity('counts', itemId);
    return { status: 200, headers, jsonBody: { itemId, count: countEntity.count || 0 } };
  } catch (err: any) {
    if (err.statusCode === 404) {
      return { status: 200, headers, jsonBody: { itemId, count: 0 } };
    }
    context.error('Error getting vote count:', err);
    return { status: 500, headers, jsonBody: { error: 'Internal server error' } };
  }
}

app.http('vote-post', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'vote',
  handler: async (req, context) => {
    if (req.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders(req) };
    }
    return postVote(req, context);
  },
});

app.http('vote-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'vote/{itemId}',
  handler: getVoteCount,
});
