"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useDisplaySettings } from "@/components/providers/DisplaySettingsProvider";
import { useCartStore } from "@/store/useCartStore";
import { useIsScrolled } from "@/hooks/useIsScrolled";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { resolveCategoryName } from "@/lib/category-locale";
import { resolveProductTranslation } from "@/lib/product-locale";
import { computeDiscountInfo } from "@/lib/price";
import ShopSidebarNav from "./ShopSidebarNav";
import {
  resolveCartIcon,
  resolveMenuIcon,
  DEFAULT_HEADER_CART_ICON,
  DEFAULT_HEADER_MENU_ICON,
} from "@/lib/storefront-ui";

// Module-scoped cache so re-opening the search doesn't refetch.
const _searchCache = { products: null, categories: null, ts: 0, locale: null };
const SEARCH_CACHE_MS = 60_000;

function HighlightedText({ text, query }) {
  if (!query || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-inherit px-0.5 rounded-sm">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function useStoreLogo() {
  // Prefer the settings hydrated by the server (via `DisplaySettingsProvider`
  // in the locale layout). This gives the header the correct icons on the
  // first paint — no fallback-to-default flicker on refresh.
  const hydrated = useDisplaySettings();
  const initial = useMemo(
    () => ({
      default: hydrated?.store_logo || null,
      dark: hydrated?.store_logo_dark || null,
      size: hydrated?.store_logo_size ?? '160',
      height: hydrated?.store_logo_height ?? '40',
      cartIcon: hydrated?.header_cart_icon ?? DEFAULT_HEADER_CART_ICON,
      menuIcon: hydrated?.header_menu_icon ?? DEFAULT_HEADER_MENU_ICON,
    }),
    [hydrated],
  );

  const [logo, setLogo] = useState(initial);

  // Keep the state in sync with the hydrated context (avoids first-paint
  // flicker — the SSR value paints immediately).
  useEffect(() => {
    if (hydrated) setLogo(initial);
  }, [hydrated, initial]);

  // Always re-fetch from the API after mount. The SSR value may be stale
  // (the [locale] layout is statically pre-rendered, so admin changes made
  // after build/deploy won't propagate through the provider until the
  // layout is revalidated). The API is short-cached, so this is cheap and
  // corrects any staleness within seconds of the admin saving new icons.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/display-settings")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.success || !json.data) return;
        setLogo({
          default: json.data.store_logo ? json.data.store_logo : null,
          dark: json.data.store_logo_dark ? json.data.store_logo_dark : null,
          size: json.data.store_logo_size ?? '160',
          height: json.data.store_logo_height ?? '40',
          cartIcon: json.data.header_cart_icon ?? DEFAULT_HEADER_CART_ICON,
          menuIcon: json.data.header_menu_icon ?? DEFAULT_HEADER_MENU_ICON,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return logo;
}

function HeaderLogo({ mode = 'light' }) {
  const logo = useStoreLogo();
  const width = Math.min(Math.max(parseInt(logo.size || '160', 10) || 160, 80), 320);
  const maxHeight = Math.min(Math.max(parseInt(logo.height || '40', 10) || 40, 20), 120);

  const renderImg = (src, extraClass = '') => (
    <Image
      src={src}
      alt="LaCérémonie"
      width={width}
      height={maxHeight}
      className={`h-auto w-auto max-w-full object-contain transition-all duration-500 ${extraClass}`}
      style={{ maxHeight: `${maxHeight}px` }}
      priority
    />
  );

  // Responsive: dark-bg logo on mobile (over hero image), light-bg logo on desktop.
  if (mode === 'responsive' && logo.dark && logo.default) {
    return (
      <>
        {renderImg(logo.dark, 'block lg:hidden')}
        {renderImg(logo.default, 'hidden lg:block')}
      </>
    );
  }

  const src = mode === 'dark' ? (logo.dark || logo.default) : (logo.default || logo.dark);
  if (!src) return <div className="h-5 w-32" />;
  return renderImg(src);
}

export default function ShopHeader({ onOpenCart, fixed = true, fixedBelow = null }) {
  const params = useParams();
  const locale = params?.locale || "en";
  const pathname = usePathname();
  const router = useRouter();
  const dict = useDictionary();
  const tSearch = dict?.shop_search ?? {};
  const { formatPrice } = useCurrency() ?? {};
  const isScrolled = useIsScrolled();
  const [isHovered, setIsHovered] = useState(false);
  // fixedBelow='lg'  → hero is behind header: dark/transparent until scroll/hover on mobile,
  //                      solid light style on desktop (lg+).
  // fixedBelow='all' → hero is below header: fixed with normal light style everywhere.
  const isMobileBehindHero = fixedBelow === 'lg';
  const isAlwaysLight = fixedBelow === 'all';
  // forceLight: fully light (white bg, dark icons) on every breakpoint.
  const forceLight = isScrolled || isHovered || isAlwaysLight;
  // behindResponsive: transparent + white icons on mobile, light on desktop (lg+).
  const behindResponsive = isMobileBehindHero && !forceLight;
  const logoMode = forceLight ? 'light' : behindResponsive ? 'responsive' : 'dark';
  // Class helpers reused by the icon buttons so the mobile/desktop split stays consistent.
  const btnClass = (light, dark) => {
    if (forceLight) return light;
    if (behindResponsive) {
      const lgLight = light.split(' ').filter(Boolean).map((c) => `lg:${c}`).join(' ');
      return `${dark} ${lgLight}`;
    }
    return dark;
  };
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchData, setSearchData] = useState({ products: [], categories: [] });
  const [activeIdx, setActiveIdx] = useState(-1);
  const searchInputRef = useRef(null);
  const headerRef = useRef(null);
  const searchOverlayRef = useRef(null);
  const searchButtonRef = useRef(null);
  const activeItemRef = useRef(null);

  // Admin-selectable header icons (cart button + sidebar-open button).
  const headerConfig = useStoreLogo();
  const CartIcon = resolveCartIcon(headerConfig.cartIcon).Icon;
  const MenuIcon = resolveMenuIcon(headerConfig.menuIcon).Icon;

  // On the home page, if the mobile bottom nav is active the sidebar/menu is
  // already reachable via the always-on Menu tab in the bottom bar — the top
  // hamburger becomes redundant on small screens, so hide it there.
  const settings = useDisplaySettings();
  const isHome = (() => {
    if (!pathname) return false;
    const parts = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    return parts.length === 0 || (parts.length === 1 && parts[0] === locale);
  })();
  const hideSidebarBtnOnMobile =
    isHome && settings?.mobile_nav_enabled !== "false";

  const { items: cartItems } = useCartStore();
  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  // Hydration-safe cart badge: don't render server-side (cart starts empty on SSR)
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // ── Cart-icon bump animation when cart count increases ──
  const [bump, setBump] = useState(false);
  const prevCountRef = useRef(cartCount);
  useEffect(() => {
    if (!mounted) return;
    if (cartCount > prevCountRef.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 600);
      prevCountRef.current = cartCount;
      return () => clearTimeout(t);
    }
    prevCountRef.current = cartCount;
  }, [cartCount, mounted]);

  // Focus search when opened
  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  // Close search on outside click — scoped to the overlay + trigger button so
  // clicks on the logo/cart/menu also close the search.
  useEffect(() => {
    if (!isSearchOpen) return;
    const onDocDown = (e) => {
      const overlay = searchOverlayRef.current;
      const btn = searchButtonRef.current;
      if (overlay?.contains(e.target)) return;
      if (btn?.contains(e.target)) return;
      setIsSearchOpen(false);
      setSearchQuery("");
      setDebouncedQuery("");
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, [isSearchOpen]);

  // Fetch products + categories once the search opens; keep a short-lived cache.
  useEffect(() => {
    if (!isSearchOpen) return;
    const fresh =
      _searchCache.locale === locale &&
      Date.now() - _searchCache.ts < SEARCH_CACHE_MS &&
      _searchCache.products &&
      _searchCache.categories;
    if (fresh) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchData({
        products: _searchCache.products,
        categories: _searchCache.categories,
      });
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    Promise.all([
      fetch(`/api/v1/products?limit=100&locale=${locale}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/v1/categories`).then((r) => r.json()).catch(() => null),
    ]).then(([p, c]) => {
      if (cancelled) return;
      const products = p?.success && Array.isArray(p.data) ? p.data : [];
      const categories = c?.success && Array.isArray(c.data) ? c.data : [];
      _searchCache.products = products;
      _searchCache.categories = categories;
      _searchCache.locale = locale;
      _searchCache.ts = Date.now();
      setSearchData({ products, categories });
      setSearchLoading(false);
    });
    return () => { cancelled = true; };
  }, [isSearchOpen, locale]);

  // Debounce the raw input so filtering only runs after the user pauses.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 120);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset the highlighted row whenever the query or dataset changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActiveIdx(-1); }, [debouncedQuery, isSearchOpen]);

  // Compute filtered results (locale-aware category/product names).
  const results = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) return { products: [], categories: [] };

    const cats = searchData.categories
      .map((c) => ({
        ...c,
        _name: resolveCategoryName(c, locale) || c.name || "",
      }))
      .filter((c) => c._name.toLowerCase().includes(q))
      .slice(0, 5);

    const prods = searchData.products
      .map((p) => resolveProductTranslation(p, locale) || p)
      .filter((p) => {
        const name = (p.name ?? "").toLowerCase();
        const desc = (p.description ?? "").toLowerCase();
        const cat = (p.category ?? "").toLowerCase();
        return name.includes(q) || desc.includes(q) || cat.includes(q);
      })
      .slice(0, 8);

    return { products: prods, categories: cats };
  }, [debouncedQuery, searchData, locale]);

  // Flatten for keyboard navigation.
  const flatResults = useMemo(
    () => [
      ...results.categories.map((c) => ({ type: "cat", id: c.id, item: c })),
      ...results.products.map((p) => ({ type: "prod", id: p.id, item: p })),
    ],
    [results],
  );

  // Keep the highlighted item scrolled into view inside the dropdown.
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setDebouncedQuery("");
  }, []);

  const goToCategory = useCallback((catId) => {
    closeSearch();
    if (isHome) {
      const el = document.getElementById(`cat-${catId}`);
      if (el) {
        history.replaceState(null, "", `#cat-${catId}`);
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    router.push(`/${locale}#cat-${catId}`);
  }, [closeSearch, isHome, router, locale]);

  const goToProduct = useCallback((prodId) => {
    closeSearch();
    router.push(`/${locale}/product/${prodId}`);
  }, [closeSearch, router, locale]);

  const onSearchKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
      return;
    }
    if (!flatResults.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % flatResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? flatResults.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = flatResults[activeIdx >= 0 ? activeIdx : 0];
      if (!pick) return;
      if (pick.type === "cat") goToCategory(pick.id);
      else goToProduct(pick.id);
    }
  }, [flatResults, activeIdx, closeSearch, goToCategory, goToProduct]);

  // Publish the header's rendered height so below-hero layouts can offset correctly.
  useEffect(() => {
    const el = headerRef.current;
    const root = document.documentElement;
    if (!el) return;
    const setHeight = () => root.style.setProperty('--header-height', `${el.offsetHeight}px`);
    setHeight();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(setHeight) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); root.style.removeProperty('--header-height'); };
  }, []);

  return (
    <>
      <ShopSidebarNav
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <header
        ref={headerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ top: 'var(--bar-height, 0px)' }}
        className={`fixed inset-x-0 z-50 transition-colors duration-500 ease-in-out ${
          forceLight
            ? "bg-white border-b border-zinc-200"
            : behindResponsive
              ? "bg-transparent border-b border-transparent lg:bg-white lg:border-zinc-200"
              : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="relative mx-auto flex items-center justify-between px-6 py-2">
          {/* Hover backdrop: only used for the transparent mobile behind-hero state. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 -z-10 transition-all duration-500 ease-in-out origin-top ${
              !isScrolled && isHovered
                ? "opacity-100 scale-y-100 backdrop-blur-md bg-white/95 shadow-sm"
                : "opacity-0 scale-y-0 backdrop-blur-none bg-transparent"
            } ${isAlwaysLight ? 'opacity-0 scale-y-0' : ''} ${isMobileBehindHero ? 'lg:opacity-0 lg:scale-y-0' : ''}`}
          />
          {/* Left: menu + logo */}
          <div
            className={`flex items-center gap-4 transition-opacity duration-200 ${
              isSearchOpen
                ? "opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto"
                : "opacity-100"
            }`}
          >
            <button
              className={`p-2 -ms-2 rounded-full hover:scale-110 active:scale-95 transition-all duration-200 ${btnClass(
                "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                "text-white hover:bg-white/10"
              )} ${hideSidebarBtnOnMobile ? "hidden lg:inline-flex" : ""}`}
              aria-label="Open sidebar"
              onClick={() => setIsSidebarOpen(true)}
            >
              <MenuIcon className="w-6 h-6" strokeWidth={1.5} />
            </button>
            <Link href={`/${locale}`} className="flex items-center">
              <HeaderLogo mode={logoMode} />
            </Link>
          </div>

          {/* Right: actions */}
          <div
            className={`flex items-center gap-2 sm:gap-3 transition-opacity duration-200 ${
              isSearchOpen
                ? "opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto"
                : "opacity-100"
            }`}
          >
            <button
              ref={searchButtonRef}
              onClick={() => setIsSearchOpen((v) => !v)}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                isSearchOpen ? "opacity-0 pointer-events-none" : ""
              } ${btnClass(
                "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
                "text-white hover:bg-white/10"
              )}`}
              aria-label="Open search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
            <button
              onClick={onOpenCart}
              className={`relative p-2 rounded-full transition-colors ${btnClass(
                "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100",
                "text-white hover:bg-white/10"
              )}`}
              aria-label="Open cart"
            >
              {/* Ripple ring on add-to-cart */}
              {bump && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 rounded-full animate-cart-ring ${
                    forceLight ? "bg-zinc-900/20" : behindResponsive ? "bg-white/30 lg:bg-zinc-900/20" : "bg-white/30"
                  }`}
                />
              )}
              <CartIcon
                strokeWidth={1.5}
                className={`w-6 h-6 ${bump ? "animate-cart-bump" : ""}`}
              />
              {mounted && cartCount > 0 && (
                <span
                  key={cartCount}
                  className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white animate-cart-badge-pop"
                >
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Search overlay */}
          <div
            ref={searchOverlayRef}
            className={`absolute top-1/2 left-6 right-6 -translate-y-1/2 md:left-1/2 md:right-auto md:w-[28rem] lg:w-[34rem] md:-translate-x-1/2 transition-all duration-300 ${
              isSearchOpen
                ? "opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-95 pointer-events-none"
            }`}
          >
            <div
              className="relative flex w-full items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5 shrink-0 text-zinc-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={tSearch.placeholder ?? "Search products or categories…"}
                aria-label={tSearch.placeholder ?? "Search products or categories"}
                aria-autocomplete="list"
                aria-controls="shop-search-results"
                className="flex-1 min-w-0 bg-transparent text-sm text-zinc-800 placeholder-zinc-400 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                  aria-label={tSearch.close ?? dict?.common?.close ?? "Clear"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Results panel */}
            {isSearchOpen && (
              <div
                id="shop-search-results"
                role="listbox"
                className="absolute left-0 right-0 top-full mt-1.5 max-h-[70vh] overflow-y-auto rounded-[5px] border border-zinc-200 bg-white"
              >
                {!debouncedQuery ? (
                  <div className="flex flex-col items-center justify-center gap-1 px-6 py-8 text-center">
                    <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-zinc-800">{tSearch.hint_title ?? "Search our store"}</p>
                    <p className="text-xs text-zinc-500">{tSearch.hint_desc ?? "Find products or browse by category."}</p>
                  </div>
                ) : searchLoading && !searchData.products.length ? (
                  <div className="flex items-center justify-center gap-2 px-6 py-8 text-sm text-zinc-500">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
                    <span>{tSearch.loading ?? "Searching…"}</span>
                  </div>
                ) : flatResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1 px-6 py-8 text-center">
                    <p className="text-sm font-medium text-zinc-800">
                      {(tSearch.no_results ?? 'No results for "{q}"').replace("{q}", debouncedQuery)}
                    </p>
                    <p className="text-xs text-zinc-500">{tSearch.no_results_hint ?? "Try a different keyword."}</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {results.categories.length > 0 && (
                      <div>
                        <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                          {tSearch.categories ?? "Categories"}
                        </div>
                        <ul>
                          {results.categories.map((c, idx) => {
                            const globalIdx = idx;
                            const isActive = globalIdx === activeIdx;
                            const count = searchData.products.filter((p) => p.category_id === c.id).length;
                            return (
                              <li
                                key={`cat-${c.id}`}
                                ref={isActive ? activeItemRef : null}
                                role="option"
                                aria-selected={isActive}
                              >
                                <button
                                  type="button"
                                  onMouseEnter={() => setActiveIdx(globalIdx)}
                                  onClick={() => goToCategory(c.id)}
                                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors ${
                                    isActive ? "bg-zinc-100" : "hover:bg-zinc-50"
                                  }`}
                                >
                                  {c.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={c.image_url}
                                      alt=""
                                      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
                                    />
                                  ) : (
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                                        <rect x="3" y="3" width="7" height="7" rx="1" />
                                        <rect x="14" y="3" width="7" height="7" rx="1" />
                                        <rect x="3" y="14" width="7" height="7" rx="1" />
                                        <rect x="14" y="14" width="7" height="7" rx="1" />
                                      </svg>
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium text-zinc-900">
                                      <HighlightedText text={c._name} query={debouncedQuery} />
                                    </div>
                                    {count > 0 && (
                                      <div className="text-[11px] text-zinc-500">
                                        {(count === 1
                                          ? (tSearch.item_count_one ?? "{n} product")
                                          : (tSearch.item_count_other ?? "{n} products")
                                        ).replace("{n}", String(count))}
                                      </div>
                                    )}
                                  </div>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-zinc-400 rtl:rotate-180">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {results.products.length > 0 && (
                      <div>
                        <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                          {tSearch.products ?? "Products"}
                        </div>
                        <ul>
                          {results.products.map((p, idx) => {
                            const globalIdx = results.categories.length + idx;
                            const isActive = globalIdx === activeIdx;
                            const { effective, percent } = computeDiscountInfo(p);
                            const base = Number(p.price) || 0;
                            const hasDiscount = percent > 0 && effective < base;
                            const priceStr = formatPrice ? formatPrice(effective) : `${effective.toFixed(2)} DH`;
                            const originalStr = formatPrice ? formatPrice(base) : `${base.toFixed(2)} DH`;
                            const img = p.image || p.main_image || null;
                            return (
                              <li
                                key={`prod-${p.id}`}
                                ref={isActive ? activeItemRef : null}
                                role="option"
                                aria-selected={isActive}
                              >
                                <button
                                  type="button"
                                  onMouseEnter={() => setActiveIdx(globalIdx)}
                                  onClick={() => goToProduct(p.id)}
                                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors ${
                                    isActive ? "bg-zinc-100" : "hover:bg-zinc-50"
                                  }`}
                                >
                                  {img ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={img}
                                      alt=""
                                      className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-zinc-200"
                                    />
                                  ) : (
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <path d="M3 15l5-5 4 4 4-4 5 5" />
                                      </svg>
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium text-zinc-900">
                                      <HighlightedText text={p.name} query={debouncedQuery} />
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                                      <span className={`font-semibold ${hasDiscount ? "text-red-600" : "text-zinc-800"}`}>
                                        {priceStr}
                                      </span>
                                      {hasDiscount && (
                                        <>
                                          <span className="text-zinc-400 line-through">{originalStr}</span>
                                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                                            -{percent}%
                                          </span>
                                        </>
                                      )}
                                      {p.category && (
                                        <span className="truncate text-zinc-500">· {p.category}</span>
                                      )}
                                    </div>
                                  </div>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-zinc-400 rtl:rotate-180">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
