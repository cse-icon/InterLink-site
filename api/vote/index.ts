import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { isValidEmail, normalizeEmail } from './email';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const votesTable = TableClient.fromConnectionString(connectionString, 'votes');
const countsTable = TableClient.fromConnectionString(connectionString, 'votecounts');

const CORS_ORIGIN = process.env.SITE_URL || 'https://interlink.products.cse-icon.com';
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function ensureTables() {
  await votesTable.createTable().catch(() => {});
  await countsTable.createTable().catch(() => {});
}

// POST /api/vote — submit a vote (immediate, no email confirmation)
async function postVote(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  await ensureTables();

  let body: { itemId?: string; email?: string };
  try {
    body = (await req.json()) as { itemId?: string; email?: string };
  } catch {
    return { status: 400, headers: CORS_HEADERS, jsonBody: { error: 'Invalid JSON body' } };
  }

  const { itemId, email } = body;

  if (!itemId || !email || !isValidEmail(email)) {
    return { status: 400, headers: CORS_HEADERS, jsonBody: { error: 'Valid itemId and email are required' } };
  }

  const normalized = normalizeEmail(email);

  // Check if this normalized email already voted for this item
  try {
    const existing = await votesTable.getEntity(itemId, normalized);
    if (existing) {
      return { status: 409, headers: CORS_HEADERS, jsonBody: { error: 'You have already voted for this item.' } };
    }
  } catch (err: any) {
    if (err.statusCode !== 404) {
      context.error('Error checking existing vote:', err);
      return { status: 500, headers: CORS_HEADERS, jsonBody: { error: 'Internal server error' } };
    }
  }

  // Record the vote immediately
  await votesTable.createEntity({
    partitionKey: itemId,
    rowKey: normalized,
    originalEmail: email.trim().toLowerCase(),
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
    headers: CORS_HEADERS,
    jsonBody: { message: 'Vote recorded. Thanks for your feedback!' },
  };
}

// GET /api/vote/{itemId} — get vote count
async function getVoteCount(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  await ensureTables();

  const itemId = req.params.itemId;
  if (!itemId) {
    return { status: 400, headers: CORS_HEADERS, jsonBody: { error: 'itemId is required' } };
  }

  try {
    const countEntity = await countsTable.getEntity('counts', itemId);
    return { status: 200, headers: CORS_HEADERS, jsonBody: { itemId, count: countEntity.count || 0 } };
  } catch (err: any) {
    if (err.statusCode === 404) {
      return { status: 200, headers: CORS_HEADERS, jsonBody: { itemId, count: 0 } };
    }
    context.error('Error getting vote count:', err);
    return { status: 500, headers: CORS_HEADERS, jsonBody: { error: 'Internal server error' } };
  }
}

app.http('vote-post', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'vote',
  handler: async (req, context) => {
    if (req.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS };
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
