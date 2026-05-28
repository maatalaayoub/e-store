"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/store/useCartStore";

/**
 * Keeps the client-side cart in sync with the current Supabase auth state.
 *
 * Cart items live in `localStorage` (per-device, per-browser). Without this,
 * if user A signs out on a shared device and user B signs in, B inherits
 * A's cart \u2014 a privacy + correctness leak.
 *
 * Strategy:
 *  - Track the current user id in a ref.
 *  - On SIGNED_OUT: clear the cart.
 *  - On SIGNED_IN: if the new user id differs from the previously-seen one,
 *    clear the cart. Otherwise (same user signing back in) preserve it so
 *    anonymous cart items merge into the logged-in session naturally.
 *
 * Renders nothing.
 */
export default function CartAuthSync() {
  const lastUserIdRef = useRef(undefined); // undefined = not yet initialised

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      lastUserIdRef.current = session?.user?.id ?? null;
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const currentId = session?.user?.id ?? null;
      const prev = lastUserIdRef.current;

      if (event === "SIGNED_OUT") {
        useCartStore.getState().clearCart();
        lastUserIdRef.current = null;
        return;
      }
      if (event === "SIGNED_IN") {
        // Only clear when the identity actually changed.
        if (prev !== undefined && prev !== null && prev !== currentId) {
          useCartStore.getState().clearCart();
        }
        lastUserIdRef.current = currentId;
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
