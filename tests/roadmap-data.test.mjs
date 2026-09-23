import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRoadmapItem } from '../scripts/roadmap-helpers.mjs';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const ROADMAP_DIR = join(REPO_ROOT, 'src', 'data', 'roadmap');
const PRODUCTS_DIR = join(REPO_ROOT, 'src', 'content', 'products');

const VALID_CATEGORIES = ['PI', 'OPC UA', 'Federation', 'Platform', 'Configuration', 'Security'];
const VALID_STATUSES = ['Backlog', 'Investigating', 'In Development', 'Released'];

/** Every synced roadmap file, one per product slug. */
const roadmapFiles = existsSync(ROADMAP_DIR)
  ? readdirSync(ROADMAP_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({
        slug: basename(f, '.json'),
        data: JSON.parse(readFileSync(join(ROADMAP_DIR, f), 'utf-8')),
      }))
  : [];

/** Product slugs that opted into a roadmap, read from their content config. */
const roadmapEnabledSlugs = existsSync(PRODUCTS_DIR)
  ? readdirSync(PRODUCTS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((slug) => existsSync(join(PRODUCTS_DIR, slug, 'product.yaml')))
      .filter((slug) => {
        const cfg = parseYaml(readFileSync(join(PRODUCTS_DIR, slug, 'product.yaml'), 'utf-8'));
        return cfg?.roadmap?.enabled === true;
      })
  : [];

// ── wiring between products and their synced data ─────────────────

describe('roadmap wiring', () => {
  it('at least one product has a roadmap', () => {
    expect(roadmapEnabledSlugs.length).toBeGreaterThan(0);
  });

  it('every roadmap data file belongs to a roadmap-enabled product', () => {
    for (const { slug } of roadmapFiles) {
      expect(
        roadmapEnabledSlugs,
        `src/data/roadmap/${slug}.json has no product with roadmap.enabled`,
      ).toContain(slug);
    }
  });

  it('every roadmap-enabled product declares a projectNumber', () => {
    for (const slug of roadmapEnabledSlugs) {
      const cfg = parseYaml(readFileSync(join(PRODUCTS_DIR, slug, 'product.yaml'), 'utf-8'));
      expect(
        cfg.roadmap.projectNumber,
        `${slug}: roadmap.enabled is true but projectNumber is missing`,
      ).toBeTruthy();
    }
  });
});

// ── per-file schema validation ────────────────────────────────────

describe.each(roadmapFiles.map((f) => [f.slug, f.data]))('roadmap/%s.json', (slug, data) => {
  it('has lastUpdated and an items array', () => {
    expect(data).toHaveProperty('lastUpdated');
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('lastUpdated is a valid ISO 8601 date, not in the future', () => {
    const date = new Date(data.lastUpdated);
    expect(date.toString()).not.toBe('Invalid Date');
    expect(date.toISOString()).toBe(data.lastUpdated);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(date.getTime()).toBeLessThan(tomorrow.getTime());
  });

  it('contains no duplicate item IDs', () => {
    const ids = data.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every item passes shape validation', () => {
    for (const item of data.items) {
      const result = validateRoadmapItem(item);
      expect(result.errors, `Item "${item.title}" in ${slug}`).toEqual([]);
    }
  });

  // Summary is allowed to be empty: transformItem defaults a missing board
  // field to ''. The sync warns about blanks so they get filled on the board
  // rather than failing the build here.
  it('every item has a string summary', () => {
    for (const item of data.items) {
      expect(typeof item.summary, `Item "${item.title}" in ${slug}`).toBe('string');
    }
  });

  it('released items have a releasedIn version', () => {
    for (const item of data.items.filter((i) => i.status === 'Released')) {
      expect(item.releasedIn, `Released item "${item.title}" is missing releasedIn`).toBeTruthy();
    }
  });

  it('non-released items have null releasedIn', () => {
    for (const item of data.items.filter((i) => i.status !== 'Released')) {
      expect(item.releasedIn, `Non-released item "${item.title}" has releasedIn set`).toBeNull();
    }
  });

  it('votes are non-negative integers', () => {
    for (const item of data.items) {
      expect(Number.isInteger(item.votes), `Item "${item.title}" has non-integer votes`).toBe(true);
      expect(item.votes).toBeGreaterThanOrEqual(0);
    }
  });

  it('uses only recognized categories', () => {
    for (const item of data.items) {
      expect(
        VALID_CATEGORIES,
        `Item "${item.title}" has unknown category "${item.category}"`,
      ).toContain(item.category);
    }
  });

  it('uses only recognized statuses', () => {
    for (const item of data.items) {
      expect(
        VALID_STATUSES,
        `Item "${item.title}" has unknown status "${item.status}"`,
      ).toContain(item.status);
    }
  });
});
