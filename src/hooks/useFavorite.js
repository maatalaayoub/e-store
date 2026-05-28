"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";

/**
 * Module-level shared cache for the current user's favorite product ids.
 *
 * Previously each <ProductCard/> hook instance fetched the entire favorites
 * list independently, producing N parallel requests on every page. Now all
 * consumers share a single in-memory Set + a single pending fetch.
 */
let favoriteIds = null; // Set<string> | null
let pendingFetch = null; // Promise | null
const subscribers = new Set();

function notify() {
  subscribers.forEach((cb) => cb());
}

function subscribe(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function snapshot() {
  return favoriteIds;
}

function serverSnapshot() {
  return null;
}

async function loadFavoriteIds() {
  if (favoriteIds) return favoriteIds;
  if (pendingFetch) return pendingFetch;
  pendingFetch = (async () => {
    try {
      const res = await fetch("/api/v1/favorites");
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) {
        favoriteIds = new Set((json.data ?? []).map((f) => f.product_id));
      } else {
        favoriteIds = new Set();
      }
    } catch {
      favoriteIds = new Set();
    } finally {
      pendingFetch = null;
      notify();
    }
    return favoriteIds;
  })();
  return pendingFetch;
}

function setFavorite(productId, isFav) {
  if (!favoriteIds) favoriteIds = new Set();
  if (isFav) favoriteIds.add(productId);
  else favoriteIds.delete(productId);
  notify();
}

/**
 * Reset the cache — call after sign-in/sign-out so a new user's list is
 * fetched on the next access.
 */
export function resetFavoritesCache() {
  favoriteIds = null;
  pendingFetch = null;
  notify();
}

/**
 * Manages the favorite state for a single product.
 * Requires the user to be logged in; silently does nothing if not.
 */
export function useFavorite(productId) {
  const ids = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId) return;
    if (favoriteIds == null) loadFavoriteIds();
  }, [productId]);

  const isFavorited = !!(ids && productId && ids.has(productId));

  const toggle = useCallback(async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (loading || !productId) return;
    setLoading(true);

    const next = !isFavorited;
    setFavorite(productId, next); // optimistic

    try {
      const res = await fetch("/api/v1/favorites", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      if (!res.ok) setFavorite(productId, !next); // revert
    } catch {
      setFavorite(productId, !next); // revert on error
    } finally {
      setLoading(false);
    }
  }, [productId, isFavorited, loading]);

  return { isFavorited, toggle, loading };
}
