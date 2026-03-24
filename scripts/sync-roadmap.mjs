/**
 * Sync roadmap data from a GitHub Projects board.
 *
 * Required environment variables:
 *   GH_TOKEN        — PAT or GitHub App token with read:project scope
 *   ORG             — GitHub organisation (e.g. "cse-icon")
 *   PROJECT_NUMBER  — Numeric project ID on the org
 *
 * Outputs: src/data/roadmap.json, src/data/roadmap-meta.json
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterPublicItems, transformItem, preserveVoteCounts } from './roadmap-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'src', 'data', 'roadmap.json');
const META_PATH = resolve(__dirname, '..', 'src', 'data', 'roadmap-meta.json');

const { GH_TOKEN, ORG, PROJECT_NUMBER } = process.env;

if (!GH_TOKEN || !ORG || !PROJECT_NUMBER) {
  console.error('Missing required env vars: GH_TOKEN, ORG, PROJECT_NUMBER');
  process.exit(1);
}

/**
 * Query the GitHub Projects v2 GraphQL API.
 * Paginates through all items automatically.
 */
async function fetchProjectItems() {
  const items = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const query = `
      query {
        organization(login: "${ORG}") {
          projectV2(number: ${PROJECT_NUMBER}) {
            items(first: 100${afterClause}) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                content {
                  ... on Issue { title }
                  ... on DraftIssue { title }
                }
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2SingleSelectField { name } }
                    }
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                    ... on ProjectV2ItemFieldCheckboxValue {
                      checked
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

    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      console.error(`GitHub API error: ${res.status} ${res.statusText}`);
      const body = await res.text();
      console.error(body);
      process.exit(1);
    }

    const json = await res.json();

    if (json.errors) {
      console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
      process.exit(1);
    }

    const project = json.data.organization.projectV2;
    if (!project) {
      console.error(`Project #${PROJECT_NUMBER} not found in org ${ORG}`);
      process.exit(1);
    }

    const page = project.items;
    items.push(...page.nodes);
    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return items;
}

async function main() {
  console.log(`Fetching project #${PROJECT_NUMBER} from ${ORG}...`);
  const rawItems = await fetchProjectItems();
  console.log(`Found ${rawItems.length} total items`);

  const publicItems = filterPublicItems(rawItems);
  console.log(`${publicItems.length} items are marked Public`);

  let roadmap = publicItems.map(transformItem);

  // Preserve existing vote counts from the current file
  try {
    const existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
    roadmap = preserveVoteCounts(roadmap, existing);
  } catch {
    // No existing file — that's fine
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(roadmap, null, 2) + '\n');

  // Write metadata with last-updated timestamp
  const meta = { lastUpdated: new Date().toISOString() };
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n');

  console.log(`Wrote ${roadmap.length} items to ${OUTPUT_PATH}`);
}

main();
