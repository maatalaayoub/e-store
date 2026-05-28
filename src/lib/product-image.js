/**
 * Resolve the main image URL of a product.
 * Looks at `product_images[]` and prefers the entry with `is_main: true`,
 * falling back to the first image. Returns `null` when no images exist.
 */
export function getMainImage(product) {
  if (!product) return null;

  if (product.main_image) return product.main_image;
  if (product.image) return product.image;

  const productImages = Array.isArray(product.product_images)
    ? product.product_images
    : [];
  const productMain = productImages.find((i) => i?.is_main) ?? productImages[0];
  if (productMain?.url) return productMain.url;

  const images = Array.isArray(product.images) ? product.images : [];
  const main = images.find((i) => i?.is_main) ?? images[0];
  return typeof main === 'string' ? main : main?.url ?? null;
}
