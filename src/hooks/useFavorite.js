"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Manages the favorite state for a single product.
 * Requires the user to be logged in; silently does nothing if not.
 */
export function useFavorite(productId) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  // On mount, check if this product is already favorited
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    fetch("/api/v1/favorites")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        const found = (json.data ?? []).some((f) => f.product_id === productId);
        setIsFavorited(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [productId]);

  const toggle = useCallback(async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (loading) return;
    setLoading(true);

    const next = !isFavorited;
    setIsFavorited(next); // optimistic

    try {
      if (next) {
        await fetch("/api/v1/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: productId }),
        });
      } else {
        await fetch("/api/v1/favorites", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: productId }),
        });
      }
    } catch {
      setIsFavorited(!next); // revert on error
    } finally {
      setLoading(false);
    }
  }, [productId, isFavorited, loading]);

  return { isFavorited, toggle, loading };
}
