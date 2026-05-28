"use client";

import { useEffect } from "react";

/**
 * Confine keyboard focus inside a container while it's open (modal/drawer).
 *
 * - On open: remembers the previously-focused element and focuses the first
 *   focusable descendant of {@link containerRef}.
 * - While open: Tab / Shift+Tab cycle inside the container.
 * - On close: restores focus to the previously-focused element.
 *
 * @param {React.RefObject<HTMLElement>} containerRef
 * @param {boolean} active
 */
export function useFocusTrap(containerRef, active) {
  useEffect(() => {
    if (!active) return;
    const root = containerRef.current;
    if (!root) return;

    const previouslyFocused = typeof document !== "undefined" ? document.activeElement : null;

    const getFocusable = () => {
      return Array.from(
        root.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null);
    };

    // Move focus into the container on open.
    const focusables = getFocusable();
    const initial = focusables[0] ?? root;
    if (initial && typeof initial.focus === "function") {
      // Defer so layout effects (e.g. transition) settle first.
      queueMicrotask(() => initial.focus({ preventScroll: true }));
    }

    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    root.addEventListener("keydown", handleKeyDown);
    return () => {
      root.removeEventListener("keydown", handleKeyDown);
      // Restore focus when the trap is torn down.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        try {
          previouslyFocused.focus({ preventScroll: true });
        } catch {
          /* element may have been removed from the DOM — ignore */
        }
      }
    };
  }, [active, containerRef]);
}
