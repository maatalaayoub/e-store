"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useProductQtyStore } from "@/store/useProductQtyStore";
import { useCurrency } from "@/components/providers/CurrencyProvider";

export default function ProductPurchasePanel({
  product,
  colors,
  sizes,
  hasColors,
  hasSizes,
  dict,
  hideCheckoutNow = false,
}) {
  const [selectedColor, setSelectedColor] = useState(hasColors ? colors[0] : null);
  const [selectedSize, setSelectedSize] = useState(hasSizes ? sizes[0] : null);
  const [added, setAdded] = useState(false);
  const { addItem } = useCartStore();
  const { getQty, setQty: storeSetQty } = useProductQtyStore();
  const qty = getQty(product.id);
  const setQty = (updater) => {
    const next = typeof updater === "function" ? updater(qty) : updater;
    storeSetQty(product.id, next);
  };
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale || "en";
  const tProduct = dict?.product ?? {};

  const isOutOfStock = product.stock <= 0;
  const { formatPrice } = useCurrency();

  const handleAdd = () => {
    addItem(product, { quantity: qty, selectedColor, selectedSize });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleCheckout = () => {
    addItem(product, { quantity: qty, selectedColor, selectedSize });
    router.push(`/${locale}/checkout`);
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Colors */}
      {hasColors && (
        <div>
          <p className="text-sm text-zinc-700 mb-3">
            {tProduct.color ?? "Color"}:{" "}
            <span className="font-semibold text-zinc-900">{selectedColor?.name}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {colors.map((c) => {
              const active = selectedColor?.name === c.name && selectedColor?.hex === c.hex;
              // Decide checkmark color based on brightness of the swatch
              const hex6 = c.hex.replace("#", "");
              const brightness =
                hex6.length >= 6
                  ? (parseInt(hex6.slice(0, 2), 16) * 299 +
                      parseInt(hex6.slice(2, 4), 16) * 587 +
                      parseInt(hex6.slice(4, 6), 16) * 114) /
                    1000
                  : 128;
              const isDark = brightness < 128;
              const isLight = brightness >= 200;
              return (
                <div key={`${c.name}-${c.hex}`} className="relative group">
                  <button
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    aria-label={c.name}
                    title={c.name}
                    style={{
                      backgroundColor: c.hex,
                      boxShadow: active
                        ? isLight
                          ? `0 0 0 2px #d1d5db, 0 0 0 4px #6b7280`
                          : `0 0 0 2px white, 0 0 0 4px ${c.hex}`
                        : undefined,
                    }}
                    className={`h-9 w-9 rounded-full transition-all duration-200 flex items-center justify-center
                      ${
                        active
                          ? "scale-110"
                          : `hover:scale-105 ring-1 ${
                              isLight
                                ? "ring-zinc-400 hover:ring-zinc-500"
                                : "ring-zinc-200 hover:ring-zinc-400"
                            }`
                      }
                    `}
                  >
                    {active && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`h-4 w-4 ${isDark ? "text-white" : "text-zinc-900"}`}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {c.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sizes */}
      {hasSizes && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-700">
              {tProduct.size ?? "Size"}: <span className="font-semibold text-zinc-900">{selectedSize}</span>
            </p>
            <a href="#" className="text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900">
              {tProduct.size_chart ?? "View Size Chart"}
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const active = selectedSize === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  className={`min-w-[3.25rem] rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                    active
                      ? "border-zinc-900 bg-zinc-50 text-zinc-900"
                      : "border-zinc-200 text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quantity + Total */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-zinc-700">{tProduct.quantity ?? "Quantity"}</p>
          <p className="text-sm text-zinc-500">
            {tProduct.total ?? "Total"}:{" "}
            <span className="text-lg font-bold text-zinc-900">
              {formatPrice(Number(product.effective_price) * qty)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-lg border border-zinc-200 h-11 bg-white">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={isOutOfStock || qty <= 1}
              className="flex h-full w-10 items-center justify-center text-zinc-500 hover:text-zinc-900 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-medium text-zinc-900">{qty}</span>
            <button
              onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
              disabled={isOutOfStock || qty >= product.stock}
              className="flex h-full w-10 items-center justify-center text-zinc-500 hover:text-zinc-900 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <span className="text-xs text-zinc-500">
            {isOutOfStock ? (tProduct.out_of_stock ?? "Out of stock") : `${product.stock} ${tProduct.available ?? "available"}`}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 pt-2">
        {!hideCheckoutNow && (
          <button
            onClick={handleAdd}
            disabled={isOutOfStock}
            className={`w-full flex items-center justify-center gap-2 rounded-[7px] px-6 h-13 text-base font-semibold text-white transition-colors ${
              isOutOfStock
                ? "bg-zinc-300 cursor-not-allowed"
                : added
                ? "bg-emerald-600"
                : "bg-zinc-900 hover:bg-zinc-800"
            }`}
          >
            {added ? (
              <>
                <Check className="h-4 w-4" />
                {tProduct.added_to_cart ?? "Added to Cart"}
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                {tProduct.add_to_cart ?? "Add To Cart"}
              </>
            )}
          </button>
        )}
        {!hideCheckoutNow && (
          <button
            onClick={handleCheckout}
            disabled={isOutOfStock}
            className="w-full flex items-center justify-center rounded-[7px] border-2 border-zinc-900 px-6 h-13 text-base font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tProduct.checkout_now ?? "Checkout Now"}
          </button>
        )}
      </div>
    </div>
  );
}
