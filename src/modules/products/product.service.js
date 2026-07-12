import { productRepository } from './product.repository';
import { resolveProductTranslation } from '@/lib/product-locale';
import { computeDiscountInfo } from '@/lib/price';

/** Compute derived fields so every layer works with a consistent shape. */
export function normalizeProduct(raw, locale) {
  if (!raw) return null;
  const images = Array.isArray(raw.product_images) ? raw.product_images : [];
  const sortedImages = [...images].sort((a, b) => {
    if (a.is_main !== b.is_main) return a.is_main ? -1 : 1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

  const mainImage = sortedImages.find((img) => img.is_main) ?? sortedImages[0] ?? null;

  // Centralised pricing math \u2014 see src/lib/price.js for precedence rules.
  const { effective: effective_price, percent: discountPercent } = computeDiscountInfo(raw);
  const badge = discountPercent > 0 ? `-${discountPercent}%` : null;

  let product = {
    ...raw,
    image: mainImage?.url ?? null,
    main_image: mainImage?.url ?? null,
    images: sortedImages,
    effective_price,
    badge,
    category: raw.categories?.name ?? null,
    use_default_sections: raw.use_default_sections !== false,
    sections_config: Array.isArray(raw.sections_config) ? raw.sections_config : null,
  };

  if (locale) product = resolveProductTranslation(product, locale);

  return product;
}

export class ProductService {
  async getProducts(options = {}) {
    const { locale, ids, ...rest } = options;
    const raw = await productRepository.findAll({ ...rest, ids });
    return raw.map((r) => normalizeProduct(r, locale));
  }

  async getProductById(id, locale) {
    if (!id) throw new Error('Product ID required');
    const raw = await productRepository.findById(id);
    return normalizeProduct(raw, locale);
  }

  async createProduct(data) {
    const payload = await sanitizeProductWritePayload(data);
    const raw = await productRepository.create(payload);
    return normalizeProduct(raw);
  }

  async updateProduct(id, data) {
    if (!id) throw new Error('Product ID required');
    const payload = await sanitizeProductWritePayload(data);
    const raw = await productRepository.update(id, payload);
    return normalizeProduct(raw);
  }

  async deleteProduct(id) {
    if (!id) throw new Error('Product ID required');
    return productRepository.delete(id);
  }

  async addImage(productId, imageData) {
    return productRepository.addImage(productId, imageData);
  }

  async setMainImage(productId, imageId) {
    return productRepository.setMainImage(productId, imageId);
  }

  async replaceImage(productId, imageId, { url, storagePath }) {
    return productRepository.replaceImage(productId, imageId, { url, storagePath });
  }

  async deleteImage(productId, imageId) {
    return productRepository.deleteImage(productId, imageId);
  }
}

/**
 * Server-side cleanup applied right before INSERT/UPDATE.
 *
 * Sections that arrive from the admin builder are sanitized via the
 * dedicated module so we never persist unsafe HTML / dangerous URLs.
 * `use_default_sections=true` always implies `sections_config=null` so
 * the two columns can never disagree on which scope wins.
 */
async function sanitizeProductWritePayload(data) {
  const payload = { ...data };

  if (Object.prototype.hasOwnProperty.call(payload, 'sections_config')) {
    const { sanitizeSections } = await import('@/modules/product-sections/sanitize');
    payload.sections_config = Array.isArray(payload.sections_config)
      ? sanitizeSections(payload.sections_config)
      : null;
  }

  if (payload.use_default_sections === true) {
    payload.sections_config = null;
  }

  return payload;
}

export const productService = new ProductService();