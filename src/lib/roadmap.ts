/**
 * Shared roadmap vocabulary: board statuses, badge colours and the item shape.
 *
 * The site, the content schemas, the sync script and the tests all import this
 * module, so each rule is defined once. It uses only erasable TypeScript so that
 * Node can load it directly from scripts/roadmap-helpers.mjs.
 *
 * Categories are deliberately not listed here. Each product declares its own in
 * the `roadmap.categories` block of its product.yaml.
 */

/** Board columns, in display order. The sync rejects an item with any other status. */
export const ROADMAP_STATUSES = [
  'Backlog',
  'Investigating',
  'In Development',
  'Released',
] as const;

export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

/**
 * Colours a product may give its roadmap categories in product.yaml. Each one
 * has a matching `.badge-<colour>` class in src/styles/global.css.
 */
export const BADGE_COLORS = [
  'slate',
  'red',
  'amber',
  'yellow',
  'green',
  'emerald',
  'cyan',
  'blue',
  'purple',
  'pink',
] as const;

export type BadgeColor = (typeof BADGE_COLORS)[number];

/** Colour for a category the product has not assigned one. */
export const DEFAULT_BADGE_COLOR: BadgeColor = 'slate';

/** Category for a board item with no `Public Category` set. */
export const UNCATEGORIZED = 'Other';

export interface RoadmapItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  status: RoadmapStatus;
  releasedIn: string | null;
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

/**
 * Badge class for a category, from the product's `roadmap.categories` map. A
 * category the product has not listed gets the neutral colour instead of
 * failing the build, so adding an option to the board never blocks a deploy.
 */
export function categoryBadge(
  category: string,
  colors: Readonly<Record<string, BadgeColor>>,
): string {
  return `badge-${colors[category] ?? DEFAULT_BADGE_COLOR}`;
}
