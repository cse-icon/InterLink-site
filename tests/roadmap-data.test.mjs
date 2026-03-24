import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRoadmapItem } from '../scripts/roadmap-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const roadmapPath = resolve(__dirname, '..', 'src', 'data', 'roadmap.json');
const metaPath = resolve(__dirname, '..', 'src', 'data', 'roadmap-meta.json');

const roadmapData = JSON.parse(readFileSync(roadmapPath, 'utf-8'));
const metaData = JSON.parse(readFileSync(metaPath, 'utf-8'));

// ── roadmap.json schema validation ────────────────────────────────

describe('roadmap.json', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(roadmapData)).toBe(true);
    expect(roadmapData.length).toBeGreaterThan(0);
  });

  it('contains no duplicate IDs', () => {
    const ids = roadmapData.map((item) => item.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it.each(roadmapData.map((item) => [item.title, item]))(
    'validates item "%s"',
    (_title, item) => {
      const result = validateRoadmapItem(item);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    },
  );

  it('every item has a non-empty summary', () => {
    for (const item of roadmapData) {
      expect(item.summary.length, `Item "${item.title}" has an empty summary`).toBeGreaterThan(0);
    }
  });

  it('released items have a releasedIn version', () => {
    const releasedItems = roadmapData.filter((item) => item.status === 'Released');
    for (const item of releasedItems) {
      expect(item.releasedIn, `Released item "${item.title}" is missing releasedIn`).toBeTruthy();
    }
  });

  it('non-released items have null releasedIn', () => {
    const nonReleasedItems = roadmapData.filter((item) => item.status !== 'Released');
    for (const item of nonReleasedItems) {
      expect(item.releasedIn, `Non-released item "${item.title}" has releasedIn set`).toBeNull();
    }
  });

  it('votes are non-negative integers', () => {
    for (const item of roadmapData) {
      expect(Number.isInteger(item.votes), `Item "${item.title}" has non-integer votes`).toBe(true);
      expect(item.votes).toBeGreaterThanOrEqual(0);
    }
  });

  it('uses only recognized categories', () => {
    const validCategories = ['PI', 'OPC UA', 'Federation', 'Platform', 'Configuration', 'Security'];
    for (const item of roadmapData) {
      expect(
        validCategories,
        `Item "${item.title}" has unknown category "${item.category}"`,
      ).toContain(item.category);
    }
  });

  it('uses only recognized statuses', () => {
    const validStatuses = ['Backlog', 'Investigating', 'In Development', 'Released'];
    for (const item of roadmapData) {
      expect(
        validStatuses,
        `Item "${item.title}" has unknown status "${item.status}"`,
      ).toContain(item.status);
    }
  });
});

// ── roadmap-meta.json ─────────────────────────────────────────────

describe('roadmap-meta.json', () => {
  it('has a lastUpdated field', () => {
    expect(metaData).toHaveProperty('lastUpdated');
  });

  it('lastUpdated is a valid ISO 8601 date', () => {
    const date = new Date(metaData.lastUpdated);
    expect(date.toString()).not.toBe('Invalid Date');
    expect(date.toISOString()).toBe(metaData.lastUpdated);
  });

  it('lastUpdated is not in the future', () => {
    const date = new Date(metaData.lastUpdated);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(date.getTime()).toBeLessThan(tomorrow.getTime());
  });
});
