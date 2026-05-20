"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { loadingProgress } from "@/lib/loading-progress";

const INITIAL_LOAD_SUPPRESS_MS = 2500;

function getUrlKey(pathname, searchParams) {
  const query = searchParams?.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function shouldTrackAnchor(anchor, event) {
  if (!anchor || event.defaultPrevented) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  try {
    const nextUrl = new URL(anchor.href, window.location.href);
    if (nextUrl.origin !== window.location.origin) return false;

    const current = window.location;
    return !(
      nextUrl.pathname === current.pathname &&
      nextUrl.search === current.search &&
      nextUrl.hash !== ""
    );
  } catch {
    return false;
  }
}

function useNavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrlRef = useRef(null);
  const finishNavigationRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const canTrackHistoryRef = useRef(false);

  useEffect(() => {
    const currentKey = getUrlKey(pathname, searchParams);

    if (currentUrlRef.current === null) {
      currentUrlRef.current = currentKey;
      return;
    }

    if (currentUrlRef.current !== currentKey) {
      currentUrlRef.current = currentKey;
      finishNavigationRef.current?.();
      finishNavigationRef.current = null;
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const settleTimer = setTimeout(() => {
      canTrackHistoryRef.current = true;
    }, INITIAL_LOAD_SUPPRESS_MS);

    const beginNavigation = ({ force = false } = {}) => {
      if (!force && !canTrackHistoryRef.current) return;
      if (finishNavigationRef.current) return;
      clearTimeout(fallbackTimerRef.current);
      finishNavigationRef.current = loadingProgress.start();
      fallbackTimerRef.current = setTimeout(() => {
        finishNavigationRef.current?.();
        finishNavigationRef.current = null;
      }, 10000);
    };

    const shouldTrackHistoryUrl = (url) => {
      if (!url) return false;
      try {
        const nextUrl = new URL(String(url), window.location.href);
        const current = window.location;
        return nextUrl.origin === current.origin && (
          nextUrl.pathname !== current.pathname || nextUrl.search !== current.search
        );
      } catch {
        return false;
      }
    };

    const onClick = (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (shouldTrackAnchor(anchor, event)) beginNavigation({ force: true });
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(...args) {
      if (shouldTrackHistoryUrl(args[2])) beginNavigation();
      return originalPushState.apply(this, args);
    };

    window.history.replaceState = function replaceState(...args) {
      if (shouldTrackHistoryUrl(args[2])) beginNavigation();
      return originalReplaceState.apply(this, args);
    };

    document.addEventListener("click", onClick, true);

    return () => {
      clearTimeout(settleTimer);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      document.removeEventListener("click", onClick, true);
      clearTimeout(fallbackTimerRef.current);
      finishNavigationRef.current?.();
    };
  }, []);
}

function useFetchProgress() {
  useEffect(() => {
    const originalFetch = window.fetch;
    let shouldTrackFetches = false;

    const settleTimer = setTimeout(() => {
      shouldTrackFetches = true;
    }, INITIAL_LOAD_SUPPRESS_MS);

    window.fetch = async (...args) => {
      const finish = shouldTrackFetches ? loadingProgress.start() : null;
      try {
        return await originalFetch(...args);
      } finally {
        finish?.();
      }
    };

    return () => {
      clearTimeout(settleTimer);
      window.fetch = originalFetch;
    };
  }, []);
}

export default function GlobalProgressBar() {
  useNavigationProgress();
  useFetchProgress();

  const progress = useSyncExternalStore(
    loadingProgress.subscribe,
    loadingProgress.getSnapshot,
    loadingProgress.getSnapshot,
  );

  return (
    <div
      data-global-progress-bar="true"
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[2147483647] h-[3px] overflow-hidden transition-opacity duration-300 ease-out ${
        progress.visible && !progress.fading ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="h-full origin-left bg-[#1447E6] shadow-[0_0_16px_rgba(20,71,230,0.45)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `scaleX(${progress.progress / 100})` }}
      />
    </div>
  );
}