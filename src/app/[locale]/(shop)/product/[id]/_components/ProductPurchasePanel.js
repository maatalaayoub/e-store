"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";

export default function ProductPurchasePanel({
  product,
  colors,
  sizes,
  hasColors,
  hasSizes,
}) {
  const [selectedColor, setSelectedColor] = useState(hasColors ? colors[0] : null);
  const [selectedSize, setSelectedSize] = useState(hasSizes ? sizes[0] : null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCartStore();

  const isOutOfStock = product.stock <= 0;

  const handleAdd = () => {
    addItem(
      {
        ...product,
        // Attach selected variant info to the cart line if needed
        selectedColor,
        selectedSize,
      },
      qty
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Colors */}
      {hasColors && (
        <div>
          <p className="text-sm text-zinc-700 mb-3">
            Color: <span className="font-semibold text-zinc-900">{selectedColor?.name}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const active = selectedColor?.name === c.name && selectedColor?.hex === c.hex;
              return (
                <button
                  key={`${c.name}-${c.hex}`}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  aria-label={c.name}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border transition-all ${
                    active
                      ? "border-zinc-900 ring-1 ring-zinc-900 ring-offset-1"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <span
                    className="block h-7 w-7 rounded-md"
                    style={{ backgroundColor: c.hex }}
                  />
                </button>
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
              Size: <span className="font-semibold text-zinc-900">{selectedSize}</span>
            </p>
            <a href="#" className="text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900">
              View Size Chart
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
          <p className="text-sm text-zinc-700">Quantity</p>
          <p className="text-sm text-zinc-500">
            Total:{" "}
            <span className="text-lg font-bold text-zinc-900">
              ${(Number(product.effective_price) * qty).toFixed(2)}
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
            {isOutOfStock ? "Out of stock" : `${product.stock} available`}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          onClick={handleAdd}
          disabled={isOutOfStock}
          className={`w-full flex items-center justify-center gap-2 rounded-xl px-6 h-13 text-base font-semibold text-white transition-colors ${
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
              Added to Cart
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              Add To Cart
            </>
          )}
        </button>
        <button
          disabled={isOutOfStock}
          className="w-full flex items-center justify-center rounded-xl border-2 border-zinc-900 px-6 h-13 text-base font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Checkout Now
        </button>
      </div>
    </div>
  );
}
