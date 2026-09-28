import { describe, it, expect } from 'vitest';
import {
  getField,
  filterPublicItems,
  transformItem,
  validateRoadmapItem,
  validateRoadmap,
  sameItems,
  itemsMissingSummary,
  releasedWithoutVersion,
  uncoloredCategories,
} from '../scripts/roadmap-helpers.mjs';
import { ROADMAP_STATUSES, UNCATEGORIZED } from '../src/lib/roadmap.ts';

// ── Helpers to build mock project items ───────────────────────────

function makeSingleSelectField(fieldName, value) {
  return { name: value, field: { name: fieldName } };
}

function makeTextField(fieldName, value) {
  return { text: value, field: { name: fieldName } };
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
        makeSingleSelectField('Public Status', 'Released'),
        makeTextField('Public Released In', 'v2.1.0'),
      ],
    });

    expect(transformItem(item)).toEqual({
      id: 'PVTI_abc',
      title: 'AF Analysis Support',
      summary: 'Expose AF Analysis outputs as OPC UA nodes',
      category: 'PI',
      status: 'Released',
      releasedIn: 'v2.1.0',
    });
  });

  it('drops releasedIn from an item that is not released yet', () => {
    const item = makeItem({
      id: 'PVTI_wip',
      title: 'Work in progress',
      fields: [
        makeSingleSelectField('Public Status', 'In Development'),
        makeTextField('Public Released In', 'v3.0.0'),
      ],
    });
    expect(transformItem(item).releasedIn).toBeNull();
  });

  it('applies defaults for missing fields', () => {
    const item = makeItem({ id: 'PVTI_min', title: 'Minimal', fields: [] });

    expect(transformItem(item)).toEqual({
      id: 'PVTI_min',
      title: 'Minimal',
      summary: '',
      category: UNCATEGORIZED,
      status: 'Backlog',
      releasedIn: null,
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

  it('does not include vote counts, which the vote API serves live', () => {
    const item = makeItem({ id: '1', title: 'New', fields: [] });
    expect(transformItem(item)).not.toHaveProperty('votes');
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
  };

  it('validates a correct item', () => {
    const result = validateRoadmapItem(validItem);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates all valid statuses', () => {
    for (const status of ROADMAP_STATUSES) {
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

  it('accepts any non-empty category, since each product names its own', () => {
    const result = validateRoadmapItem({ ...validItem, category: 'Geo SCADA' });
    expect(result.valid).toBe(true);
  });

  it('rejects an empty category', () => {
    const result = validateRoadmapItem({ ...validItem, category: '' });
    expect(result.errors).toContain('category must be a non-empty string');
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
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});

// ── itemsMissingSummary ───────────────────────────────────────────

describe('itemsMissingSummary', () => {
  it('returns titles of items with an empty summary', () => {
    const items = [
      { title: 'Has summary', summary: 'Something useful.' },
      { title: 'Blank', summary: '' },
      { title: 'Whitespace only', summary: '   ' },
    ];
    expect(itemsMissingSummary(items)).toEqual(['Blank', 'Whitespace only']);
  });

  it('tolerates a missing summary property', () => {
    expect(itemsMissingSummary([{ title: 'No field' }])).toEqual(['No field']);
  });

  it('returns an empty array when every item has a summary', () => {
    expect(itemsMissingSummary([{ title: 'A', summary: 'a' }])).toEqual([]);
  });

  it('returns an empty array for no items', () => {
    expect(itemsMissingSummary([])).toEqual([]);
  });
});

// ── validateRoadmap ───────────────────────────────────────────────

describe('validateRoadmap', () => {
  const item = (id, overrides = {}) => ({
    id,
    title: `Item ${id}`,
    summary: '',
    category: 'PI',
    status: 'Backlog',
    releasedIn: null,
    ...overrides,
  });

  it('returns no errors for a valid roadmap', () => {
    expect(validateRoadmap([item('1'), item('2')])).toEqual([]);
  });

  it('returns no errors for an empty roadmap', () => {
    expect(validateRoadmap([])).toEqual([]);
  });

  it('names the item for each invalid field', () => {
    const errors = validateRoadmap([item('1', { status: 'Done' })]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^"Item 1": status must be one of/);
  });

  it('reports duplicate ids', () => {
    expect(validateRoadmap([item('1'), item('1')])).toEqual(['"Item 1": duplicate id 1']);
  });
});

// ── sameItems ─────────────────────────────────────────────────────

describe('sameItems', () => {
  const items = [{ id: '1', title: 'A' }];

  it('is true for identical lists', () => {
    expect(sameItems(items, [{ id: '1', title: 'A' }])).toBe(true);
  });

  it('is false when an item changed', () => {
    expect(sameItems(items, [{ id: '1', title: 'B' }])).toBe(false);
  });

  it('is false when there is no existing file', () => {
    expect(sameItems(null, items)).toBe(false);
  });
});

// ── releasedWithoutVersion ────────────────────────────────────────

describe('releasedWithoutVersion', () => {
  it('returns titles of released items with no version', () => {
    const items = [
      { title: 'Versioned', status: 'Released', releasedIn: 'v1.0' },
      { title: 'Unversioned', status: 'Released', releasedIn: null },
      { title: 'In progress', status: 'Backlog', releasedIn: null },
    ];
    expect(releasedWithoutVersion(items)).toEqual(['Unversioned']);
  });
});

// ── uncoloredCategories ───────────────────────────────────────────

describe('uncoloredCategories', () => {
  it('returns categories missing from the colour map, once each, sorted', () => {
    const items = [{ category: 'PI' }, { category: 'Zeta' }, { category: 'Alpha' }, { category: 'Zeta' }];
    expect(uncoloredCategories(items, { PI: 'emerald' })).toEqual(['Alpha', 'Zeta']);
  });

  it('returns an empty array when every category has a colour', () => {
    expect(uncoloredCategories([{ category: 'PI' }], { PI: 'emerald' })).toEqual([]);
  });
});
