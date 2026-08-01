"use client";

import { useRouter, useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { isRtlLocale } from "@/config/constants";
import { useCartStore } from "@/store/useCartStore";
import { useDisplaySettings } from "@/components/providers/DisplaySettingsProvider";
import CartSidebar from "@/components/ui/CartSidebar";
import { resolveCartIcon, DEFAULT_HEADER_CART_ICON } from "@/lib/storefront-ui";

/**
 * Minimal fixed page header with a back button.
 * Hides on scroll-down, reveals on scroll-up.
 * Pass showCart={true} to include the cart icon.
 *
 * When the mobile bottom nav is enabled and the current page corresponds
 * to one of its active buttons (favorites, orders, account, home), the
 * back button and title are hidden on small screens — the bottom nav
 * already exposes those destinations, so the redundant top-left cluster
 * is dropped. If there's no cart button either, the whole header is
 * hidden on mobile.
 */
export default function PageHeader({ title, showCart = false }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const locale = params?.locale ?? "en";
  const isRtl = isRtlLocale(locale);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  // Mirror `visible` into a ref so the cart-count effect can read the
  // latest value without listing `visible` as a dep — otherwise calling
  // `setVisible(true)` would re-run the effect and its cleanup would cancel
  // the pending bump-animation timers.
  const visibleRef = useRef(true);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 10) {
        setVisible(true);
      } else {
        setVisible(y < lastY.current);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Cart (only when showCart=true) ── */
  const { items: cartItems } = useCartStore();
  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const [mounted, setMounted] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [bump, setBump] = useState(false);
  // `displayCount` lags the real cart count so the badge-pop animation
  // (driven by `key={displayCount}`) doesn't fire until the header has
  // finished sliding down.
  const [displayCount, setDisplayCount] = useState(cartCount);
  const prevCountRef = useRef(cartCount);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted || !showCart) {
      setDisplayCount(cartCount);
      prevCountRef.current = cartCount;
      return;
    }
    if (cartCount > prevCountRef.current) {
      // If the header was hidden (scrolled down), reveal it first and only
      // trigger the bump/ring animations (and refresh the badge count) once
      // the slide-in finishes — so the user actually sees the animation
      // play instead of it running while the icon is still off-screen.
      // The slide transition is 300ms; we wait 300ms so the animations
      // fire the moment the header lands.
      // NOTE: read `visible` from the ref so we don't have to add it as a
      // dep — otherwise `setVisible(true)` below would re-run this effect
      // and its cleanup would cancel the timers before they fire.
      const wasHidden = !visibleRef.current;
      setVisible(true);
      lastY.current = window.scrollY;
      prevCountRef.current = cartCount;

      const bumpDelay = wasHidden ? 300 : 0;
      const countTimer = setTimeout(() => setDisplayCount(cartCount), bumpDelay);
      const bumpTimer  = setTimeout(() => setBump(true),  bumpDelay);
      const clearTimer = setTimeout(() => setBump(false), bumpDelay + 600);
      return () => {
        clearTimeout(countTimer);
        clearTimeout(bumpTimer);
        clearTimeout(clearTimer);
      };
    }
    // Cart count went down (item removed) or stayed the same — sync
    // immediately so the badge updates without artificial delay.
    setDisplayCount(cartCount);
    prevCountRef.current = cartCount;
  }, [cartCount, mounted, showCart]);

  /* ── Icon (respects the admin-selected header cart icon) ── */
  const settings = useDisplaySettings();
  const cartIconKey =
    settings?.header_cart_icon ?? DEFAULT_HEADER_CART_ICON;
  const CartIcon = resolveCartIcon(cartIconKey).Icon;

  /* ── Hide back/title on mobile when the bottom nav already links here ── */
  // If the current page matches one of the enabled bottom-nav buttons, the
  // top-left back+title cluster is redundant on small screens — the tab bar
  // is right there. We hide it via `hidden lg:flex`. If the header would
  // otherwise be empty (no cart), we hide the whole bar on mobile too.
  const hideLeftOnMobile = useMemo(() => {
    if (!pathname || settings?.mobile_nav_enabled === "false") return false;
    // Strip leading slash + locale segment: "/en/favorites" -> "favorites".
    const parts = pathname.replace(/^\/+/, "").split("/");
    const root = parts[0] === locale ? (parts[1] ?? "") : (parts[0] ?? "");
    // Route root → mobile_nav_show_* key. Home is not gated by a title/back
    // combo (no PageHeader on "/") so it's omitted here.
    const routeToKey = {
      favorites: "mobile_nav_show_favorites",
      orders: "mobile_nav_show_orders",
      account: "mobile_nav_show_account",
    };
    const key = routeToKey[root];
    if (!key) return false;
    // `orders` defaults to hidden; others default to shown. Match the same
    // defaulting rules as MobileBottomNav.js so behaviour stays in sync.
    if (key === "mobile_nav_show_orders") {
      return settings?.[key] === "true";
    }
    return settings?.[key] !== "false";
  }, [pathname, locale, settings]);

  const hideHeaderOnMobile = hideLeftOnMobile && !showCart;

  return (
    <>
      {showCart && mounted && (
        <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      )}
      <header
        style={{ top: 'var(--bar-height, 0px)' }}
        className={`fixed inset-x-0 z-50 bg-white border-b border-zinc-100 transition-transform duration-300 ${
          visible ? "translate-y-0" : "-translate-y-full"
        } ${hideHeaderOnMobile ? "hidden lg:block" : ""}`}
      >
        <div className="mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className={`items-center gap-4 ${hideLeftOnMobile ? "hidden lg:flex" : "flex"}`}>
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center h-9 w-9 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 transition-all"
              aria-label="Go back"
            >
              <BackIcon className="h-5 w-5" />
            </button>
            {title && (
              <span className="text-base font-semibold text-zinc-900">{title}</span>
            )}
          </div>

          {showCart && (
            <button
              onClick={() => setIsCartOpen(true)}
              aria-label="Open cart"
              className="relative p-2 rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors ms-auto"
            >
              {bump && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full animate-cart-ring bg-zinc-900/20"
                />
              )}
              <CartIcon
                className={`w-6 h-6 ${bump ? "animate-cart-bump" : ""}`}
                strokeWidth={1.5}
              />
              {mounted && displayCount > 0 && (
                <span
                  key={displayCount}
                  className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white animate-cart-badge-pop"
                >
                  {displayCount > 9 ? "9+" : displayCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>
    </>
  );
}
