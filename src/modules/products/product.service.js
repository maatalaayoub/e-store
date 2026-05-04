import { productRepository } from './product.repository';
import { resolveProductTranslation } from '@/lib/product-locale';

/** Compute derived fields so every layer works with a consistent shape. */
export function normalizeProduct(raw, locale) {
  if (!raw) return null;
  const images = Array.isArray(raw.product_images) ? raw.product_images : [];
  const sortedImages = [...images].sort((a, b) => {
    if (a.is_main !== b.is_main) return a.is_main ? -1 : 1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

  const mainImage = sortedImages.find((img) => img.is_main) ?? sortedImages[0] ?? null;

  let effective_price = raw.price;
  if (raw.discount_price != null) {
    effective_price = raw.discount_price;
  } else if (raw.discount_percentage != null) {
    effective_price = raw.price * (1 - raw.discount_percentage / 100);
  }

  let badge = null;
  if (raw.discount_percentage) badge = `-${Math.round(raw.discount_percentage)}%`;
  else if (raw.discount_price) {
    const pct = Math.round(((raw.price - raw.discount_price) / raw.price) * 100);
    if (pct > 0) badge = `-${pct}%`;
  }

  let product = {
    ...raw,
    image: mainImage?.url ?? null,
    main_image: mainImage?.url ?? null,
    images: sortedImages,
    effective_price,
    badge,
    category: raw.categories?.name ?? null,
  };

  if (locale) product = resolveProductTranslation(product, locale);

  return product;
}

export class ProductService {
  async getProducts(options = {}) {
    const { locale, ...rest } = options;
    const raw = await productRepository.findAll(rest);
    return raw.map((r) => normalizeProduct(r, locale));
  }

  async getProductById(id, locale) {
    if (!id) throw new Error('Product ID required');
    const raw = await productRepository.findById(id);
    return normalizeProduct(raw, locale);
  }

  async createProduct(data) {
    const raw = await productRepository.create(data);
    return normalizeProduct(raw);
  }

  async updateProduct(id, data) {
    if (!id) throw new Error('Product ID required');
    const raw = await productRepository.update(id, data);
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

  async deleteImage(productId, imageId) {
    return productRepository.deleteImage(productId, imageId);
  }
}

export const productService = new ProductService();