/**
 * Schema.org structured data (JSON-LD) builders.
 *
 * Only fields backed by real data are emitted — never fabricate ratings,
 * reviews, prices or availability. Pure functions; safe for client + server.
 */

import { firstNonEmpty, absoluteUrl, stripHtml, truncate } from './resolve';

/** Serialize a JSON-LD object for safe injection into a <script> tag. */
export function jsonLdScript(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Product structured data.
 * @param {object} args
 * @param {object} args.product   locale-normalized product
 * @param {string} args.url       absolute canonical product URL
 * @param {string} args.currency  ISO currency code (e.g. "MAD")
 * @param {string} [args.image]   absolute image URL
 */
export function buildProductJsonLd({ product, url, currency, image }) {
  if (!product) return null;

  const attributes = product.attributes && typeof product.attributes === 'object'
    ? product.attributes
    : {};

  const description = truncate(
    firstNonEmpty(product.short_description, product.description),
    5000,
  );

  const price = Number(product.effective_price ?? product.price);
  const inStock = Number(product.stock ?? 0) > 0;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: firstNonEmpty(product.name),
    url,
  };

  if (description) data.description = description;
  if (image) data.image = [image];

  const brand = firstNonEmpty(attributes.brand, attributes.manufacturer);
  if (brand) data.brand = { '@type': 'Brand', name: brand };

  const sku = firstNonEmpty(attributes.sku, product.sku, product.id);
  if (sku) data.sku = sku;

  const gtin = firstNonEmpty(attributes.gtin, attributes.ean, attributes.upc);
  if (gtin) data.gtin = gtin;

  if (Number.isFinite(price) && price > 0 && currency) {
    data.offers = {
      '@type': 'Offer',
      url,
      priceCurrency: currency,
      price: price.toFixed(2),
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    };
  }

  return data;
}

/** BreadcrumbList for a product (Home › Category › Product). */
export function buildBreadcrumbJsonLd({ items }) {
  const list = (items ?? []).filter((i) => i && i.name && i.url);
  if (list.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: list.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: stripHtml(item.name),
      item: item.url,
    })),
  };
}

/** Organization structured data for the store. */
export function buildOrganizationJsonLd({ store, siteUrl }) {
  const name = firstNonEmpty(store?.siteName);
  if (!name || !siteUrl) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: siteUrl,
  };
  const logo = firstNonEmpty(store?.logo, store?.defaultOgImage);
  if (logo) data.logo = absoluteUrl(siteUrl, logo);
  const sameAs = (store?.socialLinks ?? []).filter(Boolean);
  if (sameAs.length > 0) data.sameAs = sameAs;
  return data;
}

/** WebSite structured data (enables the sitelinks search box when relevant). */
export function buildWebsiteJsonLd({ store, siteUrl }) {
  const name = firstNonEmpty(store?.siteName);
  if (!name || !siteUrl) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: siteUrl,
  };
}
