/**
 * Pure helper functions for roadmap sync.
 * Extracted for testability.
 */

import { ROADMAP_STATUSES, UNCATEGORIZED } from '../src/lib/roadmap.ts';

/**
 * Extract a named field value from a GitHub Projects v2 item's field values.
 *
 * Supports single select fields (returns the selected value name)
 * and text fields (returns the text).
 *
 * @param {object} item - A project item node from the GraphQL API
 * @param {string} fieldName - The name of the field to extract
 * @returns {string|null} The field value, or null if not found
 */
export function getField(item, fieldName) {
  for (const fv of item.fieldValues.nodes) {
    const field = fv.field;
    if (!field) continue;
    if (field.name === fieldName) {
      if ('name' in fv) return fv.name;
      if ('text' in fv) return fv.text;
    }
  }
  return null;
}

/**
 * Filter raw project items to only those marked as public.
 *
 * @param {object[]} items - Raw project item nodes from the GraphQL API
 * @returns {object[]} Only items where the "Public?" field is set to "Yes"
 */
export function filterPublicItems(items) {
  return items.filter((item) => getField(item, 'Public?') === 'Yes');
}

/**
 * Transform a raw GitHub Projects item into a roadmap entry.
 *
 * `releasedIn` is kept only for released items, so a version typed onto a card
 * that is still in progress is not published early.
 *
 * @param {object} item - A project item node from the GraphQL API
 * @returns {object} A roadmap entry with id, title, summary, category, status, releasedIn
 */
export function transformItem(item) {
  const status = getField(item, 'Public Status') || 'Backlog';
  return {
    id: item.id,
    title: item.content?.title || getField(item, 'Title') || 'Untitled',
    summary: getField(item, 'Public Summary') || '',
    category: getField(item, 'Public Category') || UNCATEGORIZED,
    status,
    releasedIn: status === 'Released' ? getField(item, 'Public Released In') || null : null,
  };
}

/**
 * Validate that a roadmap entry has the shape the site's content schema accepts.
 *
 * @param {object} item - A roadmap entry to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRoadmapItem(item) {
  const errors = [];

  if (!item.id || typeof item.id !== 'string') {
    errors.push('id must be a non-empty string');
  }
  if (!item.title || typeof item.title !== 'string') {
    errors.push('title must be a non-empty string');
  }
  if (typeof item.summary !== 'string') {
    errors.push('summary must be a string');
  }
  if (!item.category || typeof item.category !== 'string') {
    errors.push('category must be a non-empty string');
  }
  if (!ROADMAP_STATUSES.includes(item.status)) {
    errors.push(`status must be one of: ${ROADMAP_STATUSES.join(', ')}`);
  }
  if (item.releasedIn !== null && typeof item.releasedIn !== 'string') {
    errors.push('releasedIn must be a string or null');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a whole roadmap before it is written: every item's shape, plus
 * uniqueness of IDs. The sync refuses to write a roadmap that fails this, so
 * bad board data never reaches main.
 *
 * @param {object[]} items - Transformed roadmap entries
 * @returns {string[]} One message per problem, empty when the roadmap is valid
 */
export function validateRoadmap(items) {
  const errors = [];
  const seen = new Set();

  for (const item of items) {
    for (const error of validateRoadmapItem(item).errors) {
      errors.push(`"${item.title}": ${error}`);
    }
    if (seen.has(item.id)) {
      errors.push(`"${item.title}": duplicate id ${item.id}`);
    }
    seen.add(item.id);
  }

  return errors;
}

/**
 * Whether two item lists are identical. The sync leaves a roadmap file, and its
 * `lastUpdated`, untouched when nothing on the board changed.
 *
 * @param {object[]} a
 * @param {object[]} b
 * @returns {boolean}
 */
export function sameItems(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Titles of items that have no public summary.
 *
 * The board's `Public Summary` field is what the site renders, so a blank one
 * ships an empty card. Reported as a warning by the sync rather than failing the
 * build, since it is an editorial gap, not a data error.
 *
 * @param {object[]} items - Transformed roadmap entries
 * @returns {string[]} Titles of entries with an empty summary
 */
export function itemsMissingSummary(items) {
  return items.filter((item) => !item.summary?.trim()).map((item) => item.title);
}

/**
 * Titles of released items with no `Public Released In` version. They render
 * without a version badge, so this is a warning, not a failure.
 *
 * @param {object[]} items - Transformed roadmap entries
 * @returns {string[]}
 */
export function releasedWithoutVersion(items) {
  return items
    .filter((item) => item.status === 'Released' && !item.releasedIn)
    .map((item) => item.title);
}

/**
 * Categories used on the board that the product has not given a colour in
 * `roadmap.categories`. They render with the neutral badge; the sync warns so
 * someone can pick a colour.
 *
 * @param {object[]} items - Transformed roadmap entries
 * @param {Record<string, string>} colors - The product's `roadmap.categories`
 * @returns {string[]} Sorted, de-duplicated category names
 */
export function uncoloredCategories(items, colors) {
  const unknown = items.map((item) => item.category).filter((category) => !(category in colors));
  return [...new Set(unknown)].sort();
}
