/**
 * Service layer for product sections.
 *
 * Combines the global defaults repo + per-product sanitization helpers.
 */

import { productSectionDefaultsRepository } from './repository';
import { sanitizeSections } from './sanitize';
import { resolveProductSections } from './resolve';
import { getBuiltInDefaults } from './registry';

export class ProductSectionService {
  async getGlobalDefaults() {
    const stored = await productSectionDefaultsRepository.get();
    // Re-sanitize on read so a corrupted DB row never crashes the renderer.
    const clean = sanitizeSections(stored);
    return clean.length > 0 ? clean : getBuiltInDefaults();
  }

  async getRawGlobalDefaults() {
    return productSectionDefaultsRepository.get();
  }

  async setGlobalDefaults(sections) {
    const sanitized = sanitizeSections(sections);
    await productSectionDefaultsRepository.replace(sanitized);
    return sanitized;
  }

  /**
   * Convenience: resolve sections for a product without a separate lookup
   * round-trip. Pass the already-fetched globalDefaults to avoid another
   * DB call when rendering many products.
   */
  resolveForProduct(product, globalDefaults, locale, opts) {
    return resolveProductSections(product, globalDefaults, locale, opts);
  }
}

export const productSectionService = new ProductSectionService();
