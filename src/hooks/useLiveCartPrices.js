'use client';

import { useEffect, useState } from 'react';
import { useCartStore } from '@/store/useCartStore';

const PRICE_TOLERANCE = 0.01; // MAD
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // re-check every 5 minutes

/**
 * Reconcile cart item prices against the server-side canonical prices.
 *
 * - Fetches live prices for the products currently in the cart.
 * - Returns a `mismatches` map of lineKey → { cached, live } when the
 *   locally cached price differs from the server price.
 * - Does NOT mutate the cart automatically; UI should warn the user and
 *   let them refresh or proceed (server charges canonical prices anyway).
 */
export function useLiveCartPrices(locale = 'en') {
  const items = useCartStore((state) => state.items);
  const [mismatches, setMismatches] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!items || items.length === 0) return;

    const productIds = [...new Set(items.map((i) => i.id).filter(Boolean))];
    if (productIds.length === 0) return;

    let cancelled = false;

    const check = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/products?ids=${encodeURIComponent(productIds.join(','))}&locale=${locale}`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (!json.success || !Array.isArray(json.data)) return;

        const liveById = new Map(json.data.map((p) => [p.id, p]));
        const next = {};

        for (const item of items) {
          const live = liveById.get(item.id);
          if (!live) continue;
          const livePrice = Number(live.effective_price ?? live.price ?? 0);
          const cachedPrice = Number(item.effective_price ?? item.price ?? 0);
          if (Math.abs(livePrice - cachedPrice) > PRICE_TOLERANCE) {
            next[item.lineKey] = { cached: cachedPrice, live: livePrice, name: live.name };
          }
        }

        if (!cancelled) setMismatches(next);
      } catch (err) {
        // Best-effort: don't block checkout if price check fails.
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[useLiveCartPrices] failed:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    check();
    const interval = setInterval(check, RECONCILE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [items, locale]);

  return { mismatches, mismatchCount: Object.keys(mismatches).length, loading };
}
