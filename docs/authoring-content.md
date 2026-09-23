# Editing product content

All product copy on `products.cse-icon.com` lives in text files under
`src/content/products/`. You do not need to install anything or write code —
GitHub's web editor is enough. Every change you push to `main` rebuilds and
publishes the site in about a minute.

## How a product is put together

One folder per product. The **folder name is the URL**, so
`src/content/products/interlink/` becomes `products.cse-icon.com/interlink`.
Folder names must be lowercase, because URLs are case-sensitive.

```
src/content/products/
└── interlink/
    ├── product.yaml                  the name, hero copy, CTA, roadmap switch
    ├── sections/                      feature sections, in filename order
    │   ├── 01-data-archive.md
    │   ├── 02-asset-framework-af.md
    │   └── …
    └── variants/                      optional; for products with flavours
        └── canary.md
```

Sections render top to bottom in filename order and automatically alternate
left/right. That is why they are numbered — to reorder them, renumber the files.

## Editing copy in the browser

1. Open the file on GitHub, e.g.
   `src/content/products/interlink/sections/01-data-archive.md`.
2. Click the pencil icon.
3. Edit the text, then **Commit changes** to `main`.
4. Watch **Actions → Deploy Site**. When it is green, the change is live.

### What a section file looks like

```yaml
---
title: Data Archive
description: Connect directly to Data Archive servers and expose points via OPC UA.
icon: database
features:
  - title: Easy Direct Add
    description: Node ID is the PI point name.
  - title: Multi-Archive Support
    description: Connect to multiple Data Archives simultaneously.
---
```

Each `- title:` / `description:` pair is one card. Add a card by copying an
existing pair; remove one by deleting both of its lines. Keep the indentation
exactly as it is — YAML uses indentation for structure, and spaces are required
(never tabs).

**Available `icon` values:** `database`, `hierarchy`, `server`, `cog`, `shield`,
`globe`, `deploy`, `plug`, `sparkles`, `chart`, `search`, `bolt`. If you use
anything else the build fails and tells you the valid list, so a typo can never
reach the live site.

### Text with special characters

If a line contains a colon followed by a space, or starts with a quote, wrap the
whole value in double quotes:

```yaml
description: "Note: this needs a quoted value because of the colon."
```

For long text, `>-` lets you wrap across lines; the line breaks are collapsed
into single spaces when rendered:

```yaml
subtitle: >-
  A long sentence that would otherwise run off the edge of
  the screen, wrapped for readability.
```

### Adding a full-width image band

Put the image in `public/images/`, then add this to the section it should appear
*after*:

```yaml
imageBreakAfter:
  src: /images/your-image.webp
  alt: Describe the image for screen readers
  caption: Optional caption shown underneath
  variant: contained      # contained | full | split
  background: light       # light | dark | brand
```

## Adding a new product

1. Create `src/content/products/<slug>/product.yaml`. Copy an existing one and
   change the values — it is the fastest way to get the shape right.
2. Add at least one file in `sections/`. A product with no sections fails the
   build.
3. Leave `draft: true` while you work (see below), then remove it to publish.

Nothing else needs changing. The product page, its nav, the product index card,
and the sitemap entry are all generated from the content.

### `product.yaml` fields

| Field | Required | What it does |
| --- | --- | --- |
| `name` | yes | Display name, used in nav and on the index card |
| `shortDescription` | yes | The blurb on the product index |
| `tagline` | yes | Bold line under the hero title |
| `subtitle` | yes | Supporting paragraph under the tagline |
| `seo.title` | yes | Browser tab title and search-result heading |
| `seo.description` | yes | Search-result and link-preview description |
| `cta.heading` / `cta.body` | yes | The closing call-to-action band |
| `cta.contactEmail` | no | Defaults to `sales@cse-icon.com` |
| `order` | no | Sort position on the index; lower is earlier (default 100) |
| `draft` | no | `true` hides the product completely (default `false`) |
| `heroImage` | no | Faint background image for the hero |
| `endorsement` | no | Trust badge above the CTA (`image`, `alt`, `caption`) |
| `roadmap` | no | See below; defaults to no roadmap |

### Working in private with `draft`

```yaml
draft: true
```

A draft product is excluded from the live site, the product index, and the
sitemap — but it still builds, so you can preview it locally with `npm run dev`.
Use it while copy is being written, then delete the line (or set it to `false`)
to publish.

> `src/content/products/mcp/` is currently drafted. Its `variants/pi.md` and
> `variants/geo-scada.md` contain `TODO` placeholders that must be replaced with
> real capabilities before it is published.

## Variants: one product, several flavours

When a product ships in several flavours that share a platform, add a
`variants/` folder. Each file becomes an anchored section on the product page,
with jump links generated above them — so `anchor: canary` is reachable at
`/mcp#canary`.

```yaml
---
name: Canary
anchor: canary          # lowercase and dashes only; becomes the #link
order: 10               # position among the variants
icon: database
tagline: One line describing this flavour.
highlights:
  - title: A capability
    description: What it does.
---

Markdown below the dashes becomes prose under the highlight cards. Use it for
requirements, supported versions, and anything that needs a sentence rather
than a card.
```

Put anything flavour-specific here, and keep `sections/` for what is true of
every flavour.

## Turning on a roadmap

A product's roadmap is driven by a **private GitHub Projects board**. Only items
explicitly marked public are ever published.

```yaml
roadmap:
  enabled: true
  org: cse-icon
  projectNumber: 4       # from the board URL: /orgs/cse-icon/projects/4
```

That is the only change needed — `/<slug>/roadmap` starts building, a Roadmap
link appears in the product's nav, and the weekly sync picks up the new board
automatically. Until the first sync runs the page shows a friendly placeholder
rather than an empty board.

The project number is safe to commit: the board itself stays private and is
unreadable without the sync workflow's credentials.

For the board fields the sync expects, see **Roadmap Sync** in the
[README](../README.md#roadmap-sync).

## If the build fails

The site will not publish content that does not match the expected shape — which
means a mistake here can't break the live site. Open **Actions**, click the red
run, and read the error: it names the file and the field.

| Message | Cause |
| --- | --- |
| `Invalid option: expected one of "database"…` | Unrecognised `icon` value |
| `roadmap.projectNumber is required when roadmap.enabled is true` | Enabled a roadmap without a board number |
| `Required` next to a field name | A required field is missing or misspelled |
| `Expected array, received string` | A list item is missing its `- ` prefix |
| `bad indentation` / `unexpected end of stream` | YAML indentation is off, or a tab was used instead of spaces |

## Editing locally instead

```bash
npm install
npm run dev          # http://localhost:4321, live-reloads on save
npm run build        # the same validation CI runs
```
