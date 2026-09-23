/**
 * Sync roadmap data from private GitHub Projects v2 boards — one per product.
 *
 * Which products have a roadmap, and which board each points at, is declared in
 * src/content/products/<slug>/product.yaml under `roadmap:`. Adding a product is
 * therefore a content change with no CI variables to update.
 *
 * Required environment variables:
 *   GH_TOKEN  — GitHub App token (or PAT) with org-level read:project
 *
 * Writes src/data/roadmap/<slug>.json as { lastUpdated, items }.
 *
 * Usage:
 *   node scripts/sync-roadmap.mjs            # fetch and write
 *   node scripts/sync-roadmap.mjs --dry-run  # fetch and report, write nothing
 *
 * Note: this deliberately does not log board contents. The boards are private
 * and Actions logs are broadly readable, so only counts and the titles of items
 * already marked public are ever printed.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  filterPublicItems,
  transformItem,
  preserveVoteCounts,
  itemsMissingSummary,
} from './roadmap-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const PRODUCTS_DIR = join(REPO_ROOT, 'src', 'content', 'products');
const OUTPUT_DIR = join(REPO_ROOT, 'src', 'data', 'roadmap');

const DRY_RUN = process.argv.includes('--dry-run');
const { GH_TOKEN } = process.env;

const GRAPHQL_QUERY = `
  query($org: String!, $number: Int!, $after: String) {
    organization(login: $org) {
      projectV2(number: $number) {
        items(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            content {
              ... on Issue { title }
              ... on DraftIssue { title }
              ... on PullRequest { title }
            }
            fieldValues(first: 50) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2SingleSelectField { name } }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field { ... on ProjectV2FieldCommon { name } }
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Read every product.yaml and return those that opted into a roadmap.
 * @returns {{ slug: string, org: string, projectNumber: number }[]}
 */
function loadRoadmapProducts() {
  if (!existsSync(PRODUCTS_DIR)) {
    throw new Error(`Products directory not found: ${PRODUCTS_DIR}`);
  }

  const slugs = readdirSync(PRODUCTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const configured = [];

  for (const slug of slugs) {
    const configPath = join(PRODUCTS_DIR, slug, 'product.yaml');
    if (!existsSync(configPath)) continue;

    const product = parseYaml(readFileSync(configPath, 'utf-8'));
    const roadmap = product?.roadmap;
    if (!roadmap?.enabled) continue;

    if (!roadmap.projectNumber) {
      throw new Error(
        `${slug}: roadmap.enabled is true but roadmap.projectNumber is missing in ${configPath}`,
      );
    }

    configured.push({
      slug,
      org: roadmap.org ?? 'cse-icon',
      projectNumber: Number(roadmap.projectNumber),
    });
  }

  return configured;
}

/**
 * Fetch every item on one project board, following pagination.
 * @returns {Promise<object[]>} Raw project item nodes
 */
async function fetchProjectItems({ org, projectNumber }) {
  const items = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: GRAPHQL_QUERY,
        variables: { org, number: projectNumber, after },
      }),
    });

    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    if (json.errors) {
      // GitHub reports one error per offending field, so collapse duplicates.
      const messages = [...new Set(json.errors.map((e) => e.message))].join(' ');
      throw new Error(`GraphQL error: ${messages}`);
    }

    const project = json.data?.organization?.projectV2;
    if (!project) {
      throw new Error(`Project #${projectNumber} not found in org ${org}`);
    }

    items.push(...project.items.nodes);
    hasNextPage = project.items.pageInfo.hasNextPage;
    after = project.items.pageInfo.endCursor;
  }

  return items;
}

/** Sync one product. Returns a short result line for the summary. */
async function syncProduct({ slug, org, projectNumber }) {
  const rawItems = await fetchProjectItems({ org, projectNumber });
  const publicItems = filterPublicItems(rawItems);
  let items = publicItems.map(transformItem);

  const outputPath = join(OUTPUT_DIR, `${slug}.json`);

  // Carry forward vote counts. Azure Table Storage is the source of truth and
  // the board is re-read client-side, so this only keeps the static fallback warm.
  try {
    const existing = JSON.parse(readFileSync(outputPath, 'utf-8'));
    items = preserveVoteCounts(items, existing.items ?? []);
  } catch {
    // No existing file, or it predates the { lastUpdated, items } shape.
  }

  const missing = itemsMissingSummary(items);
  if (missing.length > 0) {
    console.warn(
      `  ! ${missing.length} public item(s) have no Public Summary and will render an empty card:`,
    );
    for (const title of missing) console.warn(`      - ${title}`);
  }

  if (DRY_RUN) {
    return `${slug}: ${items.length} public of ${rawItems.length} board items (dry run, nothing written)`;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify({ lastUpdated: new Date().toISOString(), items }, null, 2)}\n`,
  );

  return `${slug}: ${items.length} public of ${rawItems.length} board items -> ${outputPath}`;
}

async function main() {
  if (!GH_TOKEN) {
    console.error('Missing required env var: GH_TOKEN');
    process.exitCode = 1;
    return;
  }

  const products = loadRoadmapProducts();

  if (products.length === 0) {
    console.log('No products have roadmap.enabled — nothing to sync.');
    return;
  }

  console.log(
    `Syncing ${products.length} roadmap(s): ${products.map((p) => p.slug).join(', ')}${
      DRY_RUN ? ' (dry run)' : ''
    }`,
  );

  const summaries = [];
  const failures = [];

  // Every product is attempted so one bad board cannot silently skip the rest.
  for (const product of products) {
    console.log(`\n${product.slug} <- ${product.org}/projects/${product.projectNumber}`);
    try {
      summaries.push(await syncProduct(product));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  x failed: ${message}`);
      failures.push(`${product.slug}: ${message}`);
    }
  }

  console.log('\nSummary');
  for (const line of summaries) console.log(`  ok  ${line}`);
  for (const line of failures) console.log(`  err ${line}`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${products.length} roadmap(s) failed to sync.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
