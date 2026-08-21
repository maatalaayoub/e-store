import { describe, it, expect } from 'vitest';
import { resolveProductSeo, slugify, truncate, stripHtml, absoluteUrl } from './resolve';
import { sanitizeProductSeo, normalizeProductSlug } from './sanitize';
import { analyzeProductSeo } from './analyze';
import { buildProductJsonLd } from './jsonld';

const store = {
  siteName: 'Acme',
  defaultKeywords: 'shop, acme',
  defaultOgImage: 'https://cdn.acme.com/default.jpg',
  defaultIndex: true,
  defaultFollow: true,
};
const siteUrl = 'https://acme.com';

const baseProduct = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Blue Sneakers',
  short_description: 'Comfortable everyday sneakers in blue.',
  description: 'Long description here.',
  main_image: 'https://cdn.acme.com/sneakers.jpg',
  price: 100,
  effective_price: 80,
  stock: 5,
};

describe('seo helpers', () => {
  it('slugify keeps latin + arabic, drops punctuation', () => {
    expect(slugify('Blue Sneakers!')).toBe('blue-sneakers');
    expect(slugify('  Café Déjà-Vu ')).toBe('cafe-deja-vu');
    const arabic = slugify('حذاء أزرق');
    expect(arabic).toContain('-');
    expect(arabic).toMatch(/^[\u0600-\u06ff-]+$/);
  });

  it('stripHtml + truncate produce clean text', () => {
    expect(stripHtml('<b>Hi</b> &amp; bye')).toBe('Hi & bye');
    expect(truncate('one two three four five', 12)).toMatch(/…$/);
  });

  it('absoluteUrl joins base + path and passes through absolute', () => {
    expect(absoluteUrl('https://a.com', '/x')).toBe('https://a.com/x');
    expect(absoluteUrl('https://a.com/', 'x')).toBe('https://a.com/x');
    expect(absoluteUrl('https://a.com', 'https://b.com/y')).toBe('https://b.com/y');
  });
});

describe('resolveProductSeo fallbacks + overrides', () => {
  it('auto-generates title/description from product data; URL uses id when no slug is stored', () => {
    const r = resolveProductSeo({ product: baseProduct, locale: 'en', store, siteUrl });
    expect(r.title).toBe('Blue Sneakers | Acme');
    expect(r.description).toBe('Comfortable everyday sneakers in blue.');
    expect(r.slug).toBe('blue-sneakers');
    // No slug column value → canonical must resolve by UUID.
    expect(r.canonical).toBe(`https://acme.com/en/product/${baseProduct.id}`);
    expect(r.ogImage).toBe('https://cdn.acme.com/sneakers.jpg');
    expect(r.index).toBe(true);
  });

  it('uses the stored slug in the canonical URL when present', () => {
    const r = resolveProductSeo({
      product: { ...baseProduct, slug: 'blue-sneakers' },
      locale: 'en',
      store,
      siteUrl,
    });
    expect(r.canonical).toBe('https://acme.com/en/product/blue-sneakers');
  });

  it('manual SEO values win over auto fallbacks', () => {
    const product = {
      ...baseProduct,
      slug: 'custom-slug',
      seo: {
        title: 'Best Blue Sneakers 2026',
        description: 'Manual description.',
        og_image: 'https://cdn.acme.com/og.jpg',
        no_index: true,
      },
    };
    const r = resolveProductSeo({ product, locale: 'en', store, siteUrl });
    expect(r.title).toBe('Best Blue Sneakers 2026');
    expect(r.description).toBe('Manual description.');
    expect(r.slug).toBe('custom-slug');
    expect(r.ogImage).toBe('https://cdn.acme.com/og.jpg');
    expect(r.index).toBe(false);
  });

  it('per-locale SEO overrides the base', () => {
    const product = {
      ...baseProduct,
      seo: { title: 'EN title', translations: { fr: { title: 'Titre FR' } } },
    };
    const en = resolveProductSeo({ product, locale: 'en', store, siteUrl });
    const fr = resolveProductSeo({ product, locale: 'fr', store, siteUrl });
    expect(en.title).toBe('EN title');
    expect(fr.title).toBe('Titre FR');
  });
});

describe('sanitizeProductSeo', () => {
  it('strips html, drops invalid urls, coerces booleans', () => {
    const out = sanitizeProductSeo({
      title: '<script>alert(1)</script>Hello',
      canonical_url: 'javascript:alert(1)',
      og_image: 'https://cdn.acme.com/x.jpg',
      no_index: 'true',
      translations: { en: { title: 'EN' }, xx: { title: 'ignored' } },
    });
    expect(out.title).toBe('alert(1) Hello');
    expect(out.canonical_url).toBeUndefined();
    expect(out.og_image).toBe('https://cdn.acme.com/x.jpg');
    expect(out.no_index).toBe(true);
    expect(out.translations.en.title).toBe('EN');
    expect(out.translations.xx).toBeUndefined();
  });

  it('returns null when nothing meaningful is provided', () => {
    expect(sanitizeProductSeo({})).toBeNull();
    expect(sanitizeProductSeo(null)).toBeNull();
  });

  it('normalizeProductSlug prefers explicit then name', () => {
    expect(normalizeProductSlug('My Slug', 'Ignored')).toBe('my-slug');
    expect(normalizeProductSlug('', 'From Name')).toBe('from-name');
  });
});

describe('analyzeProductSeo', () => {
  it('flags invalid + duplicate slug as errors', () => {
    const resolved = resolveProductSeo({
      product: { ...baseProduct, slug: 'Bad Slug' },
      locale: 'en',
      store,
      siteUrl,
    });
    const findings = analyzeProductSeo({ resolved, duplicateSlug: true });
    const codes = findings.map((f) => f.code);
    expect(codes).toContain('slug_invalid');
  });

  it('reports missing image as a warning', () => {
    const resolved = resolveProductSeo({
      product: { ...baseProduct, main_image: null },
      locale: 'en',
      store: { ...store, defaultOgImage: '' },
      siteUrl,
    });
    const findings = analyzeProductSeo({ resolved });
    expect(findings.some((f) => f.code === 'image_missing')).toBe(true);
  });
});

describe('buildProductJsonLd', () => {
  it('emits Product schema with real offer data only', () => {
    const data = buildProductJsonLd({
      product: baseProduct,
      url: 'https://acme.com/en/product/blue-sneakers',
      currency: 'MAD',
      image: 'https://cdn.acme.com/sneakers.jpg',
    });
    expect(data['@type']).toBe('Product');
    expect(data.offers.price).toBe('80.00');
    expect(data.offers.priceCurrency).toBe('MAD');
    expect(data.offers.availability).toBe('https://schema.org/InStock');
    expect(data.aggregateRating).toBeUndefined();
  });

  it('marks out-of-stock products correctly', () => {
    const data = buildProductJsonLd({
      product: { ...baseProduct, stock: 0 },
      url: 'https://acme.com/x',
      currency: 'MAD',
      image: null,
    });
    expect(data.offers.availability).toBe('https://schema.org/OutOfStock');
    expect(data.image).toBeUndefined();
  });
});
