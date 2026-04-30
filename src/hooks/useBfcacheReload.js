"use client";

import { useEffect } from "react";

/**
 * If the page is restored from bfcache (back/forward cache), force a
 * reload so React state, timers, and listeners restart cleanly.
 */
export function useBfcacheReload() {
  useEffect(() => {
    const onPageShow = (event) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
}
