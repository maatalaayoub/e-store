/**
 * Fetches featured + active products for the homepage.
 */
export async function fetchFeaturedProducts({ signal, locale } = {}) {
  try {
    const localeParam = locale ? `&locale=${locale}` : '';
    const res = await fetch(`/api/v1/products?status=active${localeParam}`, {
      signal,
      // Let the browser honour the API's Cache-Control header
      // (public, max-age=60, stale-while-revalidate=600).
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data = Array.isArray(json) ? json : json?.data;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err?.name === "AbortError") return []; // request was cancelled — do nothing
    if (process.env.NODE_ENV !== "production") {
      console.warn("[productsService] fetch failed:", err?.message);
    }
    return [];
  }
}

