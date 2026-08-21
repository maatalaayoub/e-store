/**
 * Real-time SEO validator.
 *
 * Returns a flat list of findings ({ level, code }) so the admin UI can render
 * localized messages by `code`. Findings are advisory: only genuinely invalid
 * data (bad/duplicate slug) is flagged as `error`; everything else is a
 * `warning` or positive `good` signal.
 */

import { SEO_LIMITS } from './constants';
import { slugify } from './resolve';

/**
 * @param {object} args
 * @param {object} args.resolved  output of resolveProductSeo()
 * @param {boolean} [args.duplicateSlug]  slug collides with another product
 * @param {boolean} [args.duplicateTitle] title collides with another product
 * @returns {Array<{ level:'error'|'warning'|'good', code:string }>}
 */
export function analyzeProductSeo({ resolved, duplicateSlug, duplicateTitle }) {
  const findings = [];
  const add = (level, code) => findings.push({ level, code });

  const title = resolved?.title ?? '';
  const description = resolved?.description ?? '';
  const slug = resolved?.slug ?? '';

  // Title
  if (!title) {
    add('warning', 'title_missing');
  } else if (title.length > SEO_LIMITS.title.hardMax) {
    add('warning', 'title_long');
  } else if (title.length < SEO_LIMITS.title.min) {
    add('warning', 'title_short');
  } else {
    add('good', 'title_ok');
  }
  if (title && duplicateTitle) add('warning', 'title_duplicate');

  // Description
  if (!description) {
    add('warning', 'description_missing');
  } else if (description.length > SEO_LIMITS.description.max) {
    add('warning', 'description_long');
  } else if (description.length < SEO_LIMITS.description.min) {
    add('warning', 'description_short');
  } else {
    add('good', 'description_ok');
  }

  // Slug / URL
  if (!slug) {
    add('warning', 'slug_missing');
  } else if (slugify(slug) !== slug) {
    add('error', 'slug_invalid');
  } else if (duplicateSlug) {
    add('error', 'slug_duplicate');
  } else {
    add('good', 'slug_ok');
  }

  // Image
  if (!resolved?.ogImage) {
    add('warning', 'image_missing');
  }

  // Indexing note
  if (resolved && resolved.index === false) {
    add('warning', 'noindex');
  }

  return findings;
}

/** Count findings by level for a quick summary badge. */
export function summarizeFindings(findings) {
  return findings.reduce(
    (acc, f) => {
      acc[f.level] = (acc[f.level] ?? 0) + 1;
      return acc;
    },
    { error: 0, warning: 0, good: 0 },
  );
}
