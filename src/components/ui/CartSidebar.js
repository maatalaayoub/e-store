"use client";

import "client-only";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { FREE_SHIPPING_THRESHOLD_USD, isRtlLocale } from "@/config/constants";
import { CartSkeleton } from "@/components/skeletons";

function parsePrice(price) {
  if (typeof price === "number") return price;
  return parseFloat(String(price).replace(/[^0-9.]/g, "")) || 0;
}

export default function CartSidebar({ isOpen, onClose }) {
  const { items, removeItem, updateQuantity } = useCartStore();
  const dict = useDictionary();
  const t = dict?.cart || {};
  const params = useParams();
  const locale = params?.locale || "en";
  const isRtl = isRtlLocale(locale);
  // Zustand persist hydrates async — track when store is ready
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const subtotal = items.reduce(
    (acc, item) => acc + parsePrice(item.price) * item.quantity,
    0
  );
  const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
  // eslint-disable-next-line no-unused-vars
  const remaining = Math.max(FREE_SHIPPING_THRESHOLD_USD - subtotal, 0);
  // eslint-disable-next-line no-unused-vars
  const progress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD_USD) * 100, 100);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer — right by default, left for RTL (Arabic) */}
      <div
        className={`fixed top-0 z-[120] h-[100dvh] w-full sm:max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isRtl ? "left-0" : "right-0"
        } ${
          isOpen
            ? "translate-x-0"
            : isRtl
            ? "-translate-x-full"
            : "translate-x-full"
        }`}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-zinc-700">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <h2 className="text-base font-semibold text-zinc-900">{t.title || "Your Cart"}</h2>
            {hydrated && totalItems > 0 && (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-zinc-900 px-1.5 text-[11px] font-bold text-white">
                {totalItems}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Skeleton while store is hydrating ── */}
        {!hydrated ? (
          <CartSkeleton />
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="h-9 w-9 text-zinc-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">
                {t.empty_state_title || "Your cart is empty"}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {t.empty_state_desc || "Add items to get started."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors active:scale-95"
            >
              {t.continue_shopping || "Continue shopping"}
            </button>
          </div>
        ) : (
          <>
            {/* ── Cart items list ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {items.map((item, index) => (
                <div 
                  key={item.id} 
                  className={`flex gap-3 transition-all duration-500 ease-out ${isOpen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
                  style={{ transitionDelay: `${isOpen ? index * 75 + 150 : 0}ms` }}
                >
                  {/* Thumbnail */}
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 line-clamp-2 leading-snug">
                      {item.name}
                    </p>
                    {item.category && (
                      <p className="text-[11px] text-zinc-400 uppercase tracking-wide">
                        {item.category}
                      </p>
                    )}
                    <p className="text-sm font-bold text-zinc-900">{item.price}</p>

                    {/* Qty + Remove row */}
                    <div className="mt-auto flex items-center justify-between pt-1">
                      {/* Quantity stepper */}
                      <div className="flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white px-1">
                        <button
                          onClick={() => {
                            if (item.quantity <= 1) removeItem(item.id);
                            else updateQuantity(item.id, item.quantity - 1);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-[1.5rem] text-center text-sm font-semibold text-zinc-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-zinc-400 hover:text-red-500 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Footer: subtotal + CTA ── */}
            <div className="border-t border-zinc-200 px-5 py-5 space-y-3 shrink-0 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">{t.subtotal || "Subtotal"}</span>
                <span className="text-base font-bold text-zinc-900">
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 text-center">
                {t.shipping_calculated || "Shipping & taxes calculated at checkout"}
              </p>
              <Link
                href={`/${locale}/checkout`}
                onClick={onClose}
                className="block w-full rounded-xl bg-zinc-900 py-3.5 text-center text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-700 hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
              >
                {t.checkout || "Checkout"} — ${subtotal.toFixed(2)}
              </Link>
              <button
                onClick={onClose}
                className="w-full rounded-xl border border-zinc-200 py-3 text-center text-sm font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
              >
                {t.continue_shopping || "Continue shopping"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
