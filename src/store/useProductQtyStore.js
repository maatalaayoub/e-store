import { create } from "zustand";

/**
 * Tiny store that shares the product page's current selection between
 * ProductPurchasePanel (the variant/qty controls) and InlineCheckoutSection
 * (which builds the order line item). Holds the chosen quantity plus the
 * selected color/size/configuration variant and its price-adjusted unit price
 * so the inline checkout charges — and displays — exactly what the shopper
 * picked.
 */

/** Shallow-compare the meaningful selection fields to avoid redundant updates. */
function selectionEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.unitPrice === b.unitPrice &&
    a.basePrice === b.basePrice &&
    a.stock === b.stock &&
    a.selectedColor?.name === b.selectedColor?.name &&
    a.selectedColor?.hex === b.selectedColor?.hex &&
    a.selectedSize === b.selectedSize &&
    a.selectedVariant?.ram === b.selectedVariant?.ram &&
    a.selectedVariant?.storage === b.selectedVariant?.storage &&
    a.selectedVariant?.additional_price === b.selectedVariant?.additional_price &&
    a.selectedVariant?.sku === b.selectedVariant?.sku
  );
}

export const useProductQtyStore = create((set, get) => ({
  qtys: {}, // { [productId]: number }
  selections: {}, // { [productId]: { selectedColor, selectedSize, selectedVariant, unitPrice, basePrice, stock } }

  getQty: (productId) => get().qtys[productId] ?? 1,

  setQty: (productId, qty) =>
    set((state) => ({ qtys: { ...state.qtys, [productId]: qty } })),

  getSelection: (productId) => get().selections[productId] ?? null,

  setSelection: (productId, selection) =>
    set((state) => {
      const prev = state.selections[productId];
      // No-op when nothing meaningful changed so subscribers don't re-render
      // in a loop (the panel re-syncs on every render).
      if (selectionEqual(prev, selection)) return state;
      return { selections: { ...state.selections, [productId]: selection } };
    }),
}));
