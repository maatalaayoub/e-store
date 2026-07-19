"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useCartStore } from "@/store/useCartStore";
import { useIsScrolled } from "@/hooks/useIsScrolled";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import ShopSidebarNav from "./ShopSidebarNav";

function useStoreLogo() {
  const [logo, setLogo] = useState({ default: null, dark: null, size: '160', height: '40' });
  useEffect(() => {
    fetch("/api/v1/display-settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setLogo({
            default: json.data.store_logo ? json.data.store_logo : null,
            dark: json.data.store_logo_dark ? json.data.store_logo_dark : null,
            size: json.data.store_logo_size ?? '160',
            height: json.data.store_logo_height ?? '40',
          });
        }
      })
      .catch(() => {});
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
  const dict = useDictionary();
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
  const searchInputRef = useRef(null);
  const headerRef = useRef(null);

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

  // Close search on outside click
  useOnClickOutside(
    headerRef,
    () => {
      setIsSearchOpen(false);
      setSearchQuery("");
    },
    isSearchOpen
  );

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
        <div className="relative mx-auto flex items-center justify-between px-6 py-4">
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
              )}`}
              aria-label="Open sidebar"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={`w-6 h-6 ${bump ? "animate-cart-bump" : ""}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
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
            className={`absolute top-1/2 left-6 right-6 -translate-y-1/2 md:left-1/2 md:right-auto md:w-[26rem] lg:w-[32rem] md:-translate-x-1/2 transition-all duration-300 ${
              isSearchOpen
                ? "opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-95 pointer-events-none"
            }`}
          >
            <div className="flex w-full items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5 shrink-0 text-zinc-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsSearchOpen(false);
                    setSearchQuery("");
                  }
                }}
                placeholder={dict?.common?.search ? `${dict.common.search}…` : "Search products…"}
                className="flex-1 min-w-0 bg-transparent text-sm text-zinc-800 placeholder-zinc-400 outline-none"
              />
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                aria-label="Close search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
