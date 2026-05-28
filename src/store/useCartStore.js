import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CART_STORAGE_KEY } from "@/config/constants";

/**
 * Build a stable per-line key from the product id + selected color + size so
 * that the same product picked with two different variants becomes two
 * separate cart lines (e.g. "Red / M" vs "Red / L").
 */
export function makeCartLineKey(productId, color, size) {
  const cName = color?.name ?? "";
  const cHex = color?.hex ?? "";
  const sLabel = size ?? "";
  return `${productId}::${cName}|${cHex}::${sLabel}`;
}

function normalizeOpts(opts) {
  // Backward-compat: `addItem(product, 2)` used to pass quantity as a number.
  if (typeof opts === "number") return { quantity: opts };
  return opts ?? {};
}

function clampToStock(stock, qty) {
  const safeQty = Math.max(1, qty);
  if (stock == null) return safeQty;
  return Math.min(stock, safeQty);
}

/**
 * Strip the cart item down to only the fields the UI / checkout flow
 * actually reads. Keeping the full product blob (with long_description,
 * metadata, all images, related categories\u2026) in `localStorage` caused
 * the persisted state to balloon \u2014 a 30-item cart could be 1 MB+ and
 * synchronously block rehydration on mobile.
 */
function slimItem(product) {
  if (!product) return product;
  const firstImage = Array.isArray(product.images)
    ? product.images[0]?.url
    : Array.isArray(product.product_images)
    ? product.product_images.find((img) => img?.is_main)?.url
      ?? product.product_images[0]?.url
    : null;
  return {
    id: product.id,
    name: product.name,
    image: product.image ?? product.main_image ?? firstImage ?? null,
    price: product.price,
    effective_price: product.effective_price ?? null,
    discount_price: product.discount_price ?? null,
    discount_percentage: product.discount_percentage ?? null,
    stock: product.stock ?? null,
    // Preserve translation payload so the cart can re-resolve text locale-side
    // without a full product re-fetch \u2014 small enough to keep.
    translations: product.translations ?? null,
  };
}

export const useCartStore = create(
  persist(
    (set) => ({
      items: [],
      addItem: (product, opts) =>
        set((state) => {
          const { quantity = 1, selectedColor, selectedSize } = normalizeOpts(opts);
          // Variant info can be provided either via `opts` or attached
          // directly to the product object (legacy callers).
          const color = selectedColor ?? product.selectedColor ?? null;
          const size = selectedSize ?? product.selectedSize ?? null;
          const lineKey = makeCartLineKey(product.id, color, size);

          const existing = state.items.find((i) => i.lineKey === lineKey);
          if (existing) {
            const stock = existing.stock ?? product.stock;
            const nextQty = clampToStock(stock, existing.quantity + quantity);
            if (nextQty === existing.quantity) return state;
            return {
              items: state.items.map((i) =>
                i.lineKey === lineKey ? { ...i, quantity: nextQty } : i
              ),
            };
          }

          const newItem = {
            ...slimItem(product),
            lineKey,
            selectedColor: color,
            selectedSize: size,
            quantity: clampToStock(product.stock, quantity),
          };
          return { items: [...state.items, newItem] };
        }),
      removeItem: (lineKey) =>
        set((state) => ({
          items: state.items.filter((i) => i.lineKey !== lineKey),
        })),
      updateQuantity: (lineKey, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.lineKey === lineKey
              ? { ...i, quantity: clampToStock(i.stock, quantity) }
              : i
          ),
        })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      version: 2,
      migrate: (persistedState) => {
        if (!persistedState || !Array.isArray(persistedState.items)) {
          return persistedState;
        }
        const items = persistedState.items.map((i) => {
          if (i.lineKey) return i;
          const color = i.selectedColor ?? null;
          const size = i.selectedSize ?? null;
          return {
            ...i,
            selectedColor: color,
            selectedSize: size,
            lineKey: makeCartLineKey(i.id, color, size),
          };
        });
        return { ...persistedState, items };
      },
    }
  )
);
