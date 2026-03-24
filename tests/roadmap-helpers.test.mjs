import { describe, it, expect } from 'vitest';
import {
  getField,
  filterPublicItems,
  transformItem,
  preserveVoteCounts,
  validateRoadmapItem,
} from '../scripts/roadmap-helpers.mjs';

// ── Helpers to build mock project items ───────────────────────────

function makeSingleSelectField(fieldName, value) {
  return { name: value, field: { name: fieldName } };
}

function makeTextField(fieldName, value) {
  return { text: value, field: { name: fieldName } };
}

function makeCheckboxField(fieldName, value) {
  return { checked: value, field: { name: fieldName } };
}

function makeItem({ id, title, fields = [] }) {
  return {
    id,
    content: { title },
    fieldValues: { nodes: fields },
  };
}

// ── getField ──────────────────────────────────────────────────────

describe('getField', () => {
  it('extracts a single select field value', () => {
    const item = makeItem({
      id: '1',
      title: 'Test',
      fields: [makeSingleSelectField('Public Status', 'In Development')],
    });
    expect(getField(item, 'Public Status')).toBe('In Development');
  });

  it('extracts a text field value', () => {
    const item = makeItem({
      id: '1',
      title: 'Test',
      fields: [makeTextField('Public Summary', 'A great feature')],
    });
    expect(getField(item, 'Public Summary')).toBe('A great feature');
  });

  it('extracts a checkbox field value', () => {
    const item = makeItem({
      id: '1',
      title: 'Test',
      fields: [makeCheckboxField('Legacy', true)],
    });
    expect(getField(item, 'Legacy')).toBe(true);
  });

  it('returns null for a missing field', () => {
    const item = makeItem({ id: '1', title: 'Test', fields: [] });
    expect(getField(item, 'Nonexistent')).toBeNull();
  });

  it('returns null for a field with no field metadata', () => {
    const item = makeItem({
      id: '1',
      title: 'Test',
      fields: [{ name: 'orphan' }], // no .field property
    });
    expect(getField(item, 'orphan')).toBeNull();
  });

  it('returns the correct field when multiple fields exist', () => {
    const item = makeItem({
      id: '1',
      title: 'Test',
      fields: [
        makeSingleSelectField('Public Status', 'Backlog'),
        makeTextField('Public Summary', 'Description here'),
        makeSingleSelectField('Public Category', 'PI'),
      ],
    });
    expect(getField(item, 'Public Status')).toBe('Backlog');
    expect(getField(item, 'Public Summary')).toBe('Description here');
    expect(getField(item, 'Public Category')).toBe('PI');
  });
});

// ── filterPublicItems ─────────────────────────────────────────────

describe('filterPublicItems', () => {
  it('includes items where Public? is Yes', () => {
    const items = [
      makeItem({
        id: '1',
        title: 'Public',
        fields: [makeSingleSelectField('Public?', 'Yes')],
      }),
    ];
    expect(filterPublicItems(items)).toHaveLength(1);
  });

  it('excludes items where Public? is not set', () => {
    const items = [
      makeItem({ id: '1', title: 'Private', fields: [] }),
    ];
    expect(filterPublicItems(items)).toHaveLength(0);
  });

  it('excludes items where Public? has a different value', () => {
    const items = [
      makeItem({
        id: '1',
        title: 'Draft',
        fields: [makeSingleSelectField('Public?', 'No')],
      }),
    ];
    expect(filterPublicItems(items)).toHaveLength(0);
  });

  it('filters a mixed list correctly', () => {
    const items = [
      makeItem({ id: '1', title: 'A', fields: [makeSingleSelectField('Public?', 'Yes')] }),
      makeItem({ id: '2', title: 'B', fields: [] }),
      makeItem({ id: '3', title: 'C', fields: [makeSingleSelectField('Public?', 'Yes')] }),
      makeItem({ id: '4', title: 'D', fields: [makeSingleSelectField('Public?', 'No')] }),
    ];
    const result = filterPublicItems(items);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(['1', '3']);
  });

  it('returns an empty array for an empty input', () => {
    expect(filterPublicItems([])).toEqual([]);
  });
});

// ── transformItem ─────────────────────────────────────────────────

describe('transformItem', () => {
  it('transforms a fully populated item', () => {
    const item = makeItem({
      id: 'PVTI_abc',
      title: 'AF Analysis Support',
      fields: [
        makeTextField('Public Summary', 'Expose AF Analysis outputs as OPC UA nodes'),
        makeSingleSelectField('Public Category', 'PI'),
        makeSingleSelectField('Public Status', 'In Development'),
        makeTextField('Public Released In', 'v2.1.0'),
      ],
    });

    expect(transformItem(item)).toEqual({
      id: 'PVTI_abc',
      title: 'AF Analysis Support',
      summary: 'Expose AF Analysis outputs as OPC UA nodes',
      category: 'PI',
      status: 'In Development',
      releasedIn: 'v2.1.0',
      votes: 0,
    });
  });

  it('applies defaults for missing fields', () => {
    const item = makeItem({ id: 'PVTI_min', title: 'Minimal', fields: [] });

    expect(transformItem(item)).toEqual({
      id: 'PVTI_min',
      title: 'Minimal',
      summary: '',
      category: 'Platform',
      status: 'Backlog',
      releasedIn: null,
      votes: 0,
    });
  });

  it('uses content title over field Title', () => {
    const item = makeItem({
      id: '1',
      title: 'From Content',
      fields: [makeTextField('Title', 'From Field')],
    });
    expect(transformItem(item).title).toBe('From Content');
  });

  it('falls back to field Title when content has no title', () => {
    const item = {
      id: '1',
      content: {},
      fieldValues: { nodes: [makeTextField('Title', 'Fallback Title')] },
    };
    expect(transformItem(item).title).toBe('Fallback Title');
  });

  it('falls back to "Untitled" when no title is available', () => {
    const item = { id: '1', content: {}, fieldValues: { nodes: [] } };
    expect(transformItem(item).title).toBe('Untitled');
  });

  it('always initializes votes to 0', () => {
    const item = makeItem({ id: '1', title: 'New', fields: [] });
    expect(transformItem(item).votes).toBe(0);
  });
});

// ── preserveVoteCounts ────────────────────────────────────────────

describe('preserveVoteCounts', () => {
  it('carries forward vote counts by ID', () => {
    const newItems = [
      { id: '1', title: 'A', votes: 0 },
      { id: '2', title: 'B', votes: 0 },
    ];
    const existing = [
      { id: '1', votes: 42 },
      { id: '2', votes: 7 },
    ];
    const result = preserveVoteCounts(newItems, existing);
    expect(result[0].votes).toBe(42);
    expect(result[1].votes).toBe(7);
  });

  it('keeps 0 votes for new items not in existing data', () => {
    const newItems = [{ id: 'new-1', title: 'Brand New', votes: 0 }];
    const existing = [{ id: 'old-1', votes: 10 }];
    const result = preserveVoteCounts(newItems, existing);
    expect(result[0].votes).toBe(0);
  });

  it('handles empty existing data', () => {
    const newItems = [{ id: '1', title: 'A', votes: 0 }];
    const result = preserveVoteCounts(newItems, []);
    expect(result[0].votes).toBe(0);
  });

  it('handles empty new data', () => {
    const existing = [{ id: '1', votes: 99 }];
    const result = preserveVoteCounts([], existing);
    expect(result).toEqual([]);
  });

  it('does not mutate the input arrays', () => {
    const newItems = [{ id: '1', title: 'A', votes: 0 }];
    const existing = [{ id: '1', votes: 5 }];
    const newItemsCopy = JSON.parse(JSON.stringify(newItems));
    preserveVoteCounts(newItems, existing);
    expect(newItems).toEqual(newItemsCopy);
  });

  it('preserves zero vote counts from existing data', () => {
    const newItems = [{ id: '1', title: 'A', votes: 0 }];
    const existing = [{ id: '1', votes: 0 }];
    const result = preserveVoteCounts(newItems, existing);
    expect(result[0].votes).toBe(0);
  });

  it('handles existing items with missing votes field', () => {
    const newItems = [{ id: '1', title: 'A', votes: 0 }];
    const existing = [{ id: '1' }]; // no votes property
    const result = preserveVoteCounts(newItems, existing);
    expect(result[0].votes).toBe(0);
  });
});

// ── validateRoadmapItem ───────────────────────────────────────────

describe('validateRoadmapItem', () => {
  const validItem = {
    id: '1',
    title: 'Feature X',
    summary: 'A great feature',
    category: 'PI',
    status: 'Backlog',
    releasedIn: null,
    votes: 0,
  };

  it('validates a correct item', () => {
    const result = validateRoadmapItem(validItem);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates all valid statuses', () => {
    for (const status of ['Backlog', 'Investigating', 'In Development', 'Released']) {
      const result = validateRoadmapItem({ ...validItem, status });
      expect(result.valid).toBe(true);
    }
  });

  it('rejects an empty id', () => {
    const result = validateRoadmapItem({ ...validItem, id: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('id must be a non-empty string');
  });

  it('rejects a missing title', () => {
    const result = validateRoadmapItem({ ...validItem, title: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('title must be a non-empty string');
  });

  it('rejects an invalid status', () => {
    const result = validateRoadmapItem({ ...validItem, status: 'Done' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('status must be one of');
  });

  it('rejects negative votes', () => {
    const result = validateRoadmapItem({ ...validItem, votes: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('votes must be a non-negative number');
  });

  it('rejects non-number votes', () => {
    const result = validateRoadmapItem({ ...validItem, votes: '10' });
    expect(result.valid).toBe(false);
  });

  it('accepts a string releasedIn', () => {
    const result = validateRoadmapItem({ ...validItem, releasedIn: 'v2.0.0' });
    expect(result.valid).toBe(true);
  });

  it('rejects a non-string, non-null releasedIn', () => {
    const result = validateRoadmapItem({ ...validItem, releasedIn: 123 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('releasedIn must be a string or null');
  });

  it('collects multiple errors at once', () => {
    const result = validateRoadmapItem({
      id: '',
      title: '',
      summary: 42,
      category: 99,
      status: 'Invalid',
      releasedIn: true,
      votes: -5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});
