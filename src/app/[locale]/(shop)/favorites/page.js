"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  ChevronRight,
  ChevronLeft,
  X,
  ShoppingCart,
  Check,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useCartStore } from "@/store/useCartStore";
import { resolveProductTranslation } from "@/lib/product-locale";
import VariantPickerModal from "@/components/shop/VariantPickerModal";
import { useFavoriteIds, useFavorite } from "@/hooks/useFavorite";

// Module-level cache: persists across client-side navigations, cleared on hard refresh
let _favCache = null;

const toNumber = (v) => Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;

// Bespoke favorites card — a clean, responsive design used only on this page
// (independent of the admin-configured storefront ProductCard layout). Shows
// the product image, name, price (with discount), an add-to-cart action, and a
// clearly-designed remove-from-favorites control.
function FavoriteCard({ item, locale, t, removeLabel }) {
  const rawProduct = item.products;
  const { toggle: removeFav, loading: removing } = useFavorite(rawProduct?.id);
  const { formatPrice } = useCurrency();
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);

  const product = resolveProductTranslation(rawProduct, locale);
  const href = `/${locale}/product/${rawProduct?.id}`;
  const imgSrc = product?.main_image ?? product?.image ?? null;
  const isOutOfStock = Number(product?.stock ?? 0) <= 0;

  const effectivePrice = product?.effective_price ?? product?.price;
  const originalPrice = product?.price;
  const hasDiscount =
    effectivePrice != null &&
    originalPrice != null &&
    toNumber(effectivePrice) < toNumber(originalPrice);
  const discountPct = hasDiscount
    ? Math.round((1 - toNumber(effectivePrice) / toNumber(originalPrice)) * 100)
    : 0;

  const colors = Array.isArray(rawProduct?.colors)
    ? rawProduct.colors.filter((c) => c && c.name && c.hex)
    : [];
  const sizes = Array.isArray(rawProduct?.sizes)
    ? rawProduct.sizes.filter(Boolean)
    : [];
  const hasVariants = colors.length > 0 || sizes.length > 0;

  const commitAdd = ({ selectedColor = null, selectedSize = null } = {}) => {
    if (isOutOfStock) return;
    addItem(product, { quantity: 1, selectedColor, selectedSize });
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  };

  const handleAdd = () => {
    if (isOutOfStock) return;
    if (hasVariants) {
      setVariantOpen(true);
      return;
    }
    commitAdd();
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-colors duration-300 hover:border-zinc-400">
      {/* Remove-from-favorites */}
      <button
        type="button"
        onClick={removeFav}
        disabled={removing}
        aria-label={removeLabel}
        title={removeLabel}
        className="absolute end-2.5 top-2.5 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 backdrop-blur transition-all duration-200 hover:border-red-500 hover:bg-red-500 hover:text-white hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {removing ? (
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          <X className="h-4 w-4" strokeWidth={2.5} />
        )}
      </button>

      {/* Image */}
      <Link href={href} className="relative block aspect-square w-full overflow-hidden bg-zinc-100">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={product?.name ?? ""}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <Heart className="h-10 w-10" />
          </div>
        )}
        {hasDiscount && discountPct > 0 && (
          <span className="absolute start-2.5 top-2.5 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
            -{discountPct}%
          </span>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
            <span className="rounded-full bg-zinc-900/80 px-3 py-1 text-xs font-semibold text-white">
              {t.unavailable ?? "Unavailable"}
            </span>
          </div>
        )}
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <Link href={href} className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 transition-colors group-hover:text-zinc-600 sm:text-[15px]">
            {product?.name}
          </h3>
        </Link>

        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-base font-bold text-zinc-900">{formatPrice(effectivePrice)}</span>
          {hasDiscount && (
            <span className="text-xs font-medium text-zinc-400 line-through">
              {formatPrice(originalPrice)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={isOutOfStock}
          className={`mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
            isOutOfStock
              ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
              : added
                ? "bg-green-500 text-white"
                : "bg-zinc-900 text-white hover:bg-zinc-800"
          }`}
        >
          {isOutOfStock ? (
            t.unavailable ?? "Unavailable"
          ) : added ? (
            <>
              <Check className="h-4 w-4" /> {t.added ?? "Added!"}
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" /> {t.add_to_cart ?? "Add to Cart"}
            </>
          )}
        </button>
      </div>

      <VariantPickerModal
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
        onConfirm={({ selectedColor, selectedSize }) => {
          setVariantOpen(false);
          commitAdd({ selectedColor, selectedSize });
        }}
        product={product}
        colors={colors}
        sizes={sizes}
      />
    </article>
  );
}

export default function FavoritesPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale ?? "en";
  const dict = useDictionary();
  const tFav = dict?.favorites ?? {};
  const isRtl = ["ar", "dr"].includes(locale);
  const NavChevron = isRtl ? ChevronLeft : ChevronRight;
  const [favorites, setFavorites] = useState(() => _favCache);
  const [error, setError] = useState(null);

  // Live view of the user's favorite-ids cache. When the user un-hearts a
  // product from within `<ProductCard/>`, this set updates and we drop the
  // corresponding row from the visible list on the next render.
  const favIds = useFavoriteIds();

  const loadFavorites = useCallback(() => {
    const controller = new AbortController();
    fetch("/api/v1/favorites", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          _favCache = json.data ?? [];
          setFavorites(json.data ?? []);
        }
        else if (json.error === "Unauthorized") router.push(`/${locale}/login`);
        else setError(tFav.failed ?? "Failed to load favorites.");
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setError(tFav.failed ?? "Failed to load favorites.");
      });
    return controller;
  }, [locale, router, tFav.failed]);

  useEffect(() => {
    const controller = loadFavorites();
    return () => controller.abort();
  }, [loadFavorites]);

  // Reflect un-favorites triggered by `<ProductCard/>`'s heart button.
  const visible = useMemo(() => {
    if (!favorites) return null;
    if (!favIds) return favorites;
    return favorites.filter((f) => favIds.has(f.product_id));
  }, [favorites, favIds]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900">
      <PageHeader title={tFav.title ?? "Favorites"} showCart />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 pt-20 pb-20">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{tFav.title ?? "Favorites"}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {visible
              ? `${visible.length} ${visible.length !== 1 ? (tFav.subtitle_many ?? "saved items") : (tFav.subtitle_one ?? "saved item")}`
              : (tFav.subtitle_default ?? "Your saved items")}
          </p>
        </div>

        {/* Loading skeletons */}
        {!visible && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-zinc-200 animate-pulse aspect-[3/4]" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-center text-red-600 text-sm">
            {error}
          </div>
        )}

        {visible && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100">
              <Heart className="h-9 w-9 text-zinc-300" />
            </div>
            <p className="text-lg font-semibold text-zinc-700">{tFav.empty_title ?? "No favorites yet"}</p>
            <p className="text-sm text-zinc-400 text-center max-w-xs">
              {tFav.empty_desc ?? "Tap the heart icon on any product to save it here."}
            </p>
            <Link
              href={`/${locale}`}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
            >
              {tFav.browse ?? "Browse Products"} <NavChevron className="h-4 w-4" />
            </Link>
          </div>
        )}

        {visible && visible.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {visible.map((item) => (
              <FavoriteCard
                key={item.id}
                item={item}
                locale={locale}
                t={tFav}
                removeLabel={tFav.remove ?? "Remove from favorites"}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
