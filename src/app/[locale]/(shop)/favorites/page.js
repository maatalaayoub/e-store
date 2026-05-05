"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  Package,
  ShoppingCart,
  Trash2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useCartStore } from "@/store/useCartStore";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { getMainImage } from "@/lib/product-image";

function getEffectivePrice(product) {
  if (!product) return 0;
  if (product.discount_price != null) return Number(product.discount_price);
  if (product.discount_percentage != null) {
    return Number(product.price) * (1 - Number(product.discount_percentage) / 100);
  }
  return Number(product.price);
}

function FavoriteCard({ item, onRemove }) {
  const { formatPrice } = useCurrency();
  const { addItem } = useCartStore();
  const params = useParams();
  const locale = params?.locale ?? "en";
  const dict = useDictionary();
  const tFav = dict?.favorites ?? {};
  const product = item.products;
  const imgUrl = getMainImage(product);
  const effectivePrice = getEffectivePrice(product);
  const isDiscounted = effectivePrice < Number(product?.price ?? 0);
  const [removing, setRemoving] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    await onRemove(item.product_id);
    setRemoving(false);
  };

  const handleAddToCart = () => {
    setAdding(true);
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      effective_price: effectivePrice,
      image: imgUrl,
      quantity: 1,
    });
    setTimeout(() => setAdding(false), 800);
  };

  return (
    <div className="group relative flex flex-col rounded-lg border border-zinc-200 bg-white overflow-hidden">
      {/* Image */}
      <Link href={`/${locale}/product/${product?.id}`} className="block aspect-[4/3] bg-zinc-100 overflow-hidden">
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={product?.name ?? ""}
            width={400}
            height={300}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-10 w-10 text-zinc-300" />
          </div>
        )}
      </Link>

      {/* Remove button */}
      <button
        onClick={handleRemove}
        disabled={removing}
        className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-zinc-200 text-zinc-400 hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-50"
        aria-label={tFav.remove ?? "Remove from favorites"}
      >
        {removing ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-zinc-300 border-t-transparent animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Info */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex-1">
          <Link href={`/${locale}/product/${product?.id}`}>
            <h3 className="text-sm font-semibold text-zinc-900 line-clamp-2 hover:underline">
              {product?.name ?? "Product"}
            </h3>
          </Link>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-base font-bold text-zinc-900">
              {formatPrice(effectivePrice)}
            </span>
            {isDiscounted && (
              <span className="text-xs text-zinc-400 line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={adding || product?.status !== "active"}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="h-4 w-4" />
          {adding ? (tFav.added ?? "Added!") : product?.status !== "active" ? (tFav.unavailable ?? "Unavailable") : (tFav.add_to_cart ?? "Add to Cart")}
        </button>
      </div>
    </div>
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
  const [favorites, setFavorites] = useState(null);
  const [error, setError] = useState(null);

  const loadFavorites = useCallback(() => {
    const controller = new AbortController();
    fetch("/api/v1/favorites", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setFavorites(json.data ?? []);
        else if (json.error === "Unauthorized") router.push(`/${locale}/login`);
        else setError(tFav.failed ?? "Failed to load favorites.");
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setError(tFav.failed ?? "Failed to load favorites.");
      });
    return controller;
  }, [locale, router]);

  useEffect(() => {
    const controller = loadFavorites();
    return () => controller.abort();
  }, [loadFavorites]);

  const handleRemove = async (productId) => {
    try {
      await fetch("/api/v1/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      setFavorites((prev) => prev.filter((f) => f.product_id !== productId));
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900">
      <PageHeader title={tFav.title ?? "Favorites"} />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 pt-20 pb-20">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{tFav.title ?? "Favorites"}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {favorites
              ? `${favorites.length} ${favorites.length !== 1 ? (tFav.subtitle_many ?? "saved items") : (tFav.subtitle_one ?? "saved item")}`
              : (tFav.subtitle_default ?? "Your saved items")}
          </p>
        </div>

        {/* Loading skeletons */}
        {!favorites && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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

        {favorites && favorites.length === 0 && (
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

        {favorites && favorites.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {favorites.map((item) => (
              <FavoriteCard key={item.id} item={item} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
