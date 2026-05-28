"use client";

import { useEffect, useRef, useState } from "react";
import { X, Check, ShoppingCart } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/**
 * VariantPickerModal
 *
 * Lightweight modal that asks the customer to pick a color and/or size
 * before the product is added to the cart. Renders nothing when `open`
 * is false. Validates that every offered axis (color/size) has a value
 * selected before allowing confirmation.
 *
 * Props:
 *   - open        : boolean
 *   - onClose     : () => void
 *   - onConfirm   : ({ selectedColor, selectedSize }) => void
 *   - product     : product object (used for image/title/price)
 *   - colors      : Array<{ name, hex }>
 *   - sizes       : Array<string>
 */
export default function VariantPickerModal({
  open,
  onClose,
  onConfirm,
  product,
  colors = [],
  sizes = [],
}) {
  const dict = useDictionary();
  const tProduct = dict?.product ?? {};
  const tCommon = dict?.common ?? {};
  const { formatPrice } = useCurrency();

  const hasColors = colors.length > 0;
  const hasSizes = sizes.length > 0;

  const [selectedColor, setSelectedColor] = useState(hasColors ? colors[0] : null);
  const [selectedSize, setSelectedSize] = useState(hasSizes ? sizes[0] : null);
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, open);

  // Reset state whenever the modal opens for a new product.
  useEffect(() => {
    if (!open) return;
    setSelectedColor(hasColors ? colors[0] : null);
    setSelectedSize(hasSizes ? sizes[0] : null);
    setSubmitted(false);
  }, [open, hasColors, hasSizes, colors, sizes]);

  // Lock body scroll while open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !product) return null;

  const missingColor = hasColors && !selectedColor;
  const missingSize = hasSizes && !selectedSize;
  const canConfirm = !missingColor && !missingSize;

  const handleConfirm = () => {
    setSubmitted(true);
    if (!canConfirm) return;
    onConfirm?.({
      selectedColor: hasColors ? selectedColor : null,
      selectedSize: hasSizes ? selectedSize : null,
    });
  };

  const img = product.main_image ?? product.image ?? null;
  const price = product.effective_price ?? product.price;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={dialogRef}
        className="relative w-full sm:max-w-md bg-white shadow-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[95dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-zinc-100">
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={product.name}
              className="h-14 w-14 shrink-0 rounded-lg object-cover bg-zinc-100"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900 truncate">
              {tProduct.choose_options ?? "Choose options"}
            </h2>
            <p className="text-xs text-zinc-500 truncate mt-0.5">{product.name}</p>
            {price != null && (
              <p className="text-sm font-bold text-zinc-900 mt-1">{formatPrice(price)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon.close ?? "Close"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 transition-colors -me-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {hasColors && (
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-sm text-zinc-700">
                  {tProduct.color ?? "Color"}:{" "}
                  <span className="font-semibold text-zinc-900">
                    {selectedColor?.name ?? "—"}
                  </span>
                </p>
                {submitted && missingColor && (
                  <span className="text-xs text-red-500 font-medium">
                    {tProduct.select_color ?? "Select a color"}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {colors.map((c) => {
                  const active =
                    selectedColor?.name === c.name && selectedColor?.hex === c.hex;
                  const hex6 = String(c.hex ?? "").replace("#", "");
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
                    <button
                      type="button"
                      key={`${c.name}-${c.hex}`}
                      onClick={() => setSelectedColor(c)}
                      title={c.name}
                      aria-label={c.name}
                      style={{
                        backgroundColor: c.hex,
                        boxShadow: active
                          ? isLight
                            ? `0 0 0 2px #d1d5db, 0 0 0 4px #6b7280`
                            : `0 0 0 2px white, 0 0 0 4px ${c.hex}`
                          : undefined,
                      }}
                      className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                        active
                          ? "scale-110"
                          : `hover:scale-105 ring-1 ${
                              isLight
                                ? "ring-zinc-400 hover:ring-zinc-500"
                                : "ring-zinc-200 hover:ring-zinc-400"
                            }`
                      }`}
                    >
                      {active && (
                        <Check
                          className={`h-4 w-4 ${isDark ? "text-white" : "text-zinc-900"}`}
                          strokeWidth={3}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasSizes && (
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-sm text-zinc-700">
                  {tProduct.size ?? "Size"}:{" "}
                  <span className="font-semibold text-zinc-900">
                    {selectedSize ?? "—"}
                  </span>
                </p>
                {submitted && missingSize && (
                  <span className="text-xs text-red-500 font-medium">
                    {tProduct.select_size ?? "Select a size"}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const active = selectedSize === s;
                  return (
                    <button
                      type="button"
                      key={s}
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
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-100 bg-white">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm && submitted}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors active:scale-[0.98]"
          >
            <ShoppingCart className="h-4 w-4" />
            {tProduct.add_to_cart ?? "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
