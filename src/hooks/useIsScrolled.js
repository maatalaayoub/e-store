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

    // Check periodically for asynchronous scroll restoration.
    // Next.js and browsers often restore scroll position without firing a scroll event,
    // causing the state to be stale (e.g. transparent header when scrolled down).
    const interval = setInterval(handleScroll, 150);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearInterval(interval);
    };
  }, [threshold]);

  return scrolled;
}
