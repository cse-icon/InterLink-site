/**
 * Shared roadmap vocabulary.
 *
 * Statuses, categories and their badge classes were previously duplicated
 * across RoadmapBoard.astro, RoadmapItem.astro, the sync helpers and the tests.
 * This is the single source of truth; the badge classes themselves are defined
 * in src/styles/global.css.
 */

/** Board columns, in display order. A status outside this set is dropped. */
export const ROADMAP_STATUSES = [
  'Backlog',
  'Investigating',
  'In Development',
  'Released',
] as const;

export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

/** Recognised `Public Category` values from the GitHub Projects board. */
export const ROADMAP_CATEGORIES = [
  'PI',
  'OPC UA',
  'Platform',
  'Configuration',
  'Security',
  'Federation',
] as const;

export type RoadmapCategory = (typeof ROADMAP_CATEGORIES)[number];

export interface RoadmapItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  status: string;
  releasedIn: string | null;
  votes: number;
}

/** Kanban columns. `label` may differ from the status it maps to. */
export const ROADMAP_COLUMNS: ReadonlyArray<{
  key: RoadmapStatus;
  label: string;
  color: string;
}> = [
  { key: 'Backlog', label: 'Backlog', color: 'bg-slate-400' },
  { key: 'Investigating', label: 'Investigating', color: 'bg-yellow-400' },
  { key: 'In Development', label: 'In Development', color: 'bg-blue-400' },
  { key: 'Released', label: 'Recently Released', color: 'bg-green-400' },
];

const CATEGORY_BADGES: Record<string, string> = {
  PI: 'badge-pi',
  'OPC UA': 'badge-opcua',
  Platform: 'badge-platform',
  Configuration: 'badge-configuration',
  Security: 'badge-security',
  Federation: 'badge-federation',
};

/** Badge class for a category, falling back to the Platform styling. */
export function categoryBadge(category: string): string {
  return CATEGORY_BADGES[category] ?? 'badge-platform';
}
