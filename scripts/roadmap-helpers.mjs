/**
 * Pure helper functions for roadmap sync.
 * Extracted for testability.
 */

/**
 * Extract a named field value from a GitHub Projects v2 item's field values.
 *
 * Supports single select fields (returns the selected value name),
 * text fields (returns the text), and checkbox fields (returns boolean).
 *
 * @param {object} item - A project item node from the GraphQL API
 * @param {string} fieldName - The name of the field to extract
 * @returns {string|boolean|null} The field value, or null if not found
 */
export function getField(item, fieldName) {
  for (const fv of item.fieldValues.nodes) {
    const field = fv.field;
    if (!field) continue;
    if (field.name === fieldName) {
      if ('name' in fv) return fv.name;
      if ('text' in fv) return fv.text;
      if ('checked' in fv) return fv.checked;
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
 * @param {object} item - A project item node from the GraphQL API
 * @returns {object} A roadmap entry with id, title, summary, category, status, releasedIn, votes
 */
export function transformItem(item) {
  return {
    id: item.id,
    title: item.content?.title || getField(item, 'Title') || 'Untitled',
    summary: getField(item, 'Public Summary') || '',
    category: getField(item, 'Public Category') || 'Platform',
    status: getField(item, 'Public Status') || 'Backlog',
    releasedIn: getField(item, 'Public Released In') || null,
    votes: 0,
  };
}

/**
 * Preserve existing vote counts when merging new roadmap data.
 * Matches items by ID and carries forward the vote count from the existing data.
 *
 * @param {object[]} newItems - Newly synced roadmap items (votes default to 0)
 * @param {object[]} existingItems - Previously saved roadmap items with vote counts
 * @returns {object[]} The new items with vote counts preserved from existing data
 */
export function preserveVoteCounts(newItems, existingItems) {
  const voteLookup = Object.fromEntries(
    existingItems.map((e) => [e.id, e.votes || 0]),
  );
  return newItems.map((item) => ({
    ...item,
    votes: voteLookup[item.id] !== undefined ? voteLookup[item.id] : item.votes,
  }));
}

/**
 * Validate that a roadmap entry has the expected shape.
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
  if (typeof item.category !== 'string') {
    errors.push('category must be a string');
  }

  const validStatuses = ['Backlog', 'Investigating', 'In Development', 'Released'];
  if (!validStatuses.includes(item.status)) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);
  }

  if (item.releasedIn !== null && typeof item.releasedIn !== 'string') {
    errors.push('releasedIn must be a string or null');
  }
  if (typeof item.votes !== 'number' || item.votes < 0) {
    errors.push('votes must be a non-negative number');
  }

  return { valid: errors.length === 0, errors };
}
