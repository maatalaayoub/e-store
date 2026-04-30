import { featuredProductsFallback } from "@/data/featuredProducts";

/**
 * Fetches products from the public API. Falls back to static data on failure
 * so the storefront never shows an empty grid for users.
 */
export async function fetchFeaturedProducts({ signal } = {}) {
  try {
    const res = await fetch("/api/v1/products", { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data = Array.isArray(json) ? json : json?.data;
    if (Array.isArray(data) && data.length > 0) return data;
    return featuredProductsFallback;
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[productsService] using fallback:", err?.message);
    }
    return featuredProductsFallback;
  }
}
