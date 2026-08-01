"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
 */
export default function PageHeader({ title, showCart = false }) {
  const router = useRouter();
  const params = useParams();
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

  return (
    <>
      {showCart && mounted && (
        <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      )}
      <header
        style={{ top: 'var(--bar-height, 0px)' }}
        className={`fixed inset-x-0 z-50 bg-white border-b border-zinc-100 transition-transform duration-300 ${
          visible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
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
              className="relative p-2 rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
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
