"use client";

import { useEffect } from "react";

/**
 * Calls `handler` when a pointer event fires outside `ref.current`.
 * Pass `enabled=false` to suspend listeners (e.g. when overlay is closed).
 */
export function useOnClickOutside(ref, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const listener = (event) => {
      const node = ref.current;
      if (!node || node.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener, { passive: true });
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler, enabled]);
}
