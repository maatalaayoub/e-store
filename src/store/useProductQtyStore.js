import { create } from "zustand";

/**
 * Tiny store that holds the selected quantity per product on the product page.
 * Used to share qty between ProductPurchasePanel (controls) and
 * InlineCheckoutSection (order line item).
 */
export const useProductQtyStore = create((set, get) => ({
  qtys: {}, // { [productId]: number }

  getQty: (productId) => get().qtys[productId] ?? 1,

  setQty: (productId, qty) =>
    set((state) => ({ qtys: { ...state.qtys, [productId]: qty } })),
}));
