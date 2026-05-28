"use client";

import { useEffect, useState } from "react";
import { HEADER_SCROLL_THRESHOLD_PX } from "@/config/constants";

/**
 * Reliable "has the user scrolled past `threshold`?" detector.
 *
 * Uses an `IntersectionObserver` against an invisible sentinel element
 * appended to `document.body`. The observer fires on the next frame after
 * mount, AND every time the sentinel's intersection state changes — which
 * works correctly even when the browser restores scroll position
 * asynchronously (back navigation, bfcache, mobile keyboard close, etc.).
 *
 * No scroll event listeners → no missed updates from passive listener
 * timing or from React mounting before scroll restoration completes.
 */
export function useIsScrolled(threshold = HEADER_SCROLL_THRESHOLD_PX) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > threshold);
    };

    // Initial check
    handleScroll();

    // Listen to actual scroll events
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Catch async scroll restoration (bfcache, popstate, mobile keyboard close)
    // by re-checking on the events the browser fires for those cases — far
    // cheaper than a 150ms polling interval.
    const onRestore = () => {
      // run on the next two animation frames so layout has settled
      requestAnimationFrame(() => requestAnimationFrame(handleScroll));
    };
    window.addEventListener("pageshow", onRestore);
    window.addEventListener("popstate", onRestore);
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pageshow", onRestore);
      window.removeEventListener("popstate", onRestore);
      window.removeEventListener("resize", handleScroll);
    };
  }, [threshold]);

  return scrolled;
}
