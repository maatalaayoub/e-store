"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { isRtlLocale } from "@/config/constants";
import { useCartStore } from "@/store/useCartStore";
import CartSidebar from "@/components/ui/CartSidebar";

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
  const prevCountRef = useRef(cartCount);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted || !showCart) return;
    if (cartCount > prevCountRef.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 600);
      prevCountRef.current = cartCount;
      return () => clearTimeout(t);
    }
    prevCountRef.current = cartCount;
  }, [cartCount, mounted, showCart]);

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
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={`w-6 h-6 ${bump ? "animate-cart-bump" : ""}`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
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
          )}
        </div>
      </header>
    </>
  );
}
