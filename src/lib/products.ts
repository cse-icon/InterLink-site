import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export type Product = CollectionEntry<'products'>;
export type ProductSection = CollectionEntry<'productSections'>;
export type ProductVariant = CollectionEntry<'productVariants'>;

/**
 * Helpers over the product collections.
 *
 * A product's collection id is its slug (see generateId in content.config.ts).
 * Sections and variants keep their full path as their id, so they are matched
 * back to a product by the `<slug>/` prefix.
 */

/**
 * Whether a product should be rendered.
 *
 * Drafts are hidden from production builds but kept in `astro dev`, so
 * work-in-progress copy can be previewed locally before it is published.
 */
function isVisible(product: Product): boolean {
  return import.meta.env.PROD ? !product.data.draft : true;
}

/** Visible products, ordered for display. */
export async function getProducts(): Promise<Product[]> {
  const products = await getCollection('products', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
  return products.sort(
    (a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name),
  );
}

/** A single visible product, or undefined if missing or hidden. */
export async function getProduct(slug: string): Promise<Product | undefined> {
  const product = await getEntry('products', slug);
  return product && isVisible(product) ? product : undefined;
}

/** Feature sections for a product, ordered by filename (e.g. 01-, 02-). */
export async function getSectionsFor(slug: string): Promise<ProductSection[]> {
  const sections = await getCollection('productSections', ({ id }) =>
    id.startsWith(`${slug}/`),
  );
  return sections.sort((a, b) => a.id.localeCompare(b.id));
}

/** Variants for a product, ordered by `order` then name. */
export async function getVariantsFor(slug: string): Promise<ProductVariant[]> {
  const variants = await getCollection('productVariants', ({ id }) =>
    id.startsWith(`${slug}/`),
  );
  return variants.sort(
    (a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name),
  );
}

export interface NavLink {
  label: string;
  href: string;
}

/**
 * Nav links for a product. Roadmap only appears when the product opted in,
 * so a product without a board never shows a link to an empty page.
 */
export function navFor(product: Product): NavLink[] {
  const links: NavLink[] = [{ label: 'Features', href: `/${product.id}` }];
  if (product.data.roadmap.enabled) {
    links.push({ label: 'Roadmap', href: `/${product.id}/roadmap` });
  }
  return links;
}
