import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { iconNames } from './lib/icons';
import { ROADMAP_CATEGORIES, ROADMAP_STATUSES } from './lib/roadmap';

/**
 * Content collections for the multi-product site.
 *
 * Every product lives in src/content/products/<slug>/ and is composed of:
 *   product.yaml    — identity, hero copy, CTA, SEO, roadmap opt-in
 *   sections/*.md   — feature sections, ordered by filename
 *   variants/*.md   — optional flavours, rendered as anchored sections
 *
 * The <slug> directory name is the URL segment, so /interlink renders
 * src/content/products/interlink/. See docs/authoring-content.md.
 */

/** The directory name of a product is its slug and its collection id. */
const slugFromEntry = ({ entry }: { entry: string }) => entry.split('/')[0];

const feature = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

/**
 * Opt-in pointer to a private GitHub Projects v2 board.
 *
 * The project *number* is not a secret — the board itself stays private and is
 * unreadable without the sync workflow's GitHub App token — so keeping it in
 * content means adding a product is a pure content change with no CI variables
 * to update. Consumed by scripts/sync-roadmap.mjs.
 */
const roadmapConfig = z
  .object({
    enabled: z.boolean().default(false),
    org: z.string().default('cse-icon'),
    projectNumber: z.number().int().positive().optional(),
  })
  .refine((r) => !r.enabled || r.projectNumber !== undefined, {
    message:
      'roadmap.projectNumber is required when roadmap.enabled is true — find it in the board URL, e.g. /orgs/cse-icon/projects/5 is 5',
    path: ['projectNumber'],
  });

const products = defineCollection({
  loader: glob({
    pattern: '*/product.yaml',
    base: './src/content/products',
    generateId: slugFromEntry,
  }),
  schema: z.object({
    /** Display name, used in nav, product cards and the default page title. */
    name: z.string().min(1),
    /** Ascending sort order on the product index. */
    order: z.number().int().default(100),
    /** Omit from the build and the index entirely. Use while copy is in progress. */
    draft: z.boolean().default(false),
    /** One or two sentences for the product index card. */
    shortDescription: z.string().min(1),
    /** Bold one-liner under the hero title. */
    tagline: z.string().min(1),
    /** Supporting paragraph under the tagline. */
    subtitle: z.string().min(1),
    heroImage: z.string().optional(),
    /** Optional trust badge rendered above the closing CTA. */
    endorsement: z
      .object({
        image: z.string().min(1),
        alt: z.string().min(1),
        caption: z.string().min(1),
      })
      .optional(),
    cta: z.object({
      heading: z.string().min(1),
      body: z.string().min(1),
      contactEmail: z.email().default('sales@cse-icon.com'),
    }),
    seo: z.object({
      title: z.string().min(1),
      description: z.string().min(1),
    }),
    roadmap: roadmapConfig.default({ enabled: false, org: 'cse-icon' }),
  }),
});

const productSections = defineCollection({
  loader: glob({ pattern: '*/sections/*.md', base: './src/content/products' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    icon: z.enum(iconNames),
    features: z.array(feature).min(1),
    /** Optional full-width image band rendered after this section. */
    imageBreakAfter: z
      .object({
        src: z.string().min(1),
        alt: z.string().min(1),
        caption: z.string().optional(),
        variant: z.enum(['contained', 'full', 'split']).default('contained'),
        background: z.enum(['light', 'dark', 'brand']).default('light'),
      })
      .optional(),
  }),
});

const productVariants = defineCollection({
  loader: glob({ pattern: '*/variants/*.md', base: './src/content/products' }),
  schema: z.object({
    name: z.string().min(1),
    /** In-page anchor and jump-link target, e.g. `canary` -> #canary. */
    anchor: z.string().regex(/^[a-z0-9-]+$/, 'anchor must be lowercase kebab-case'),
    order: z.number().int().default(100),
    tagline: z.string().min(1),
    icon: z.enum(iconNames).default('plug'),
    highlights: z.array(feature).min(1),
  }),
});

/**
 * Roadmap data written by scripts/sync-roadmap.mjs, one file per product,
 * named for the product slug. Schema-checked here so a malformed sync fails
 * the build instead of rendering a broken board.
 */
const roadmaps = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/roadmap' }),
  schema: z.object({
    lastUpdated: z.iso.datetime(),
    items: z.array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        // May be empty: transformItem defaults a missing Public Summary to ''.
        summary: z.string(),
        category: z.enum(ROADMAP_CATEGORIES),
        status: z.enum(ROADMAP_STATUSES),
        releasedIn: z.string().nullable(),
        votes: z.number().int().nonnegative(),
      }),
    ),
  }),
});

export const collections = { products, productSections, productVariants, roadmaps };
