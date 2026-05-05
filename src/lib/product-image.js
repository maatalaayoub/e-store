/**
 * Resolve the main image URL of a product.
 * Looks at `product_images[]` and prefers the entry with `is_main: true`,
 * falling back to the first image. Returns `null` when no images exist.
 */
export function getMainImage(product) {
  const images = product?.product_images ?? [];
  const main = images.find((i) => i.is_main) ?? images[0];
  return main?.url ?? null;
}
