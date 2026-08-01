"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useDisplaySettings } from "@/components/providers/DisplaySettingsProvider";
import ProductCard from "@/components/shop/ProductCard";
import { useFavoriteIds } from "@/hooks/useFavorite";

// Module-level cache: persists across client-side navigations, cleared on hard refresh
let _favCache = null;

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

  // Pull the storefront-wide product-card display settings so the cards on
  // this page look identical to those on the home page / product carousels.
  const settings = useDisplaySettings();
  const cardProps = useMemo(
    () => ({
      buttonStyle:          settings?.product_card_button_style,
      filledBg:             settings?.product_card_filled_bg,
      filledText:           settings?.product_card_filled_text,
      outlineBorder:        settings?.product_card_outline_border,
      outlineText:          settings?.product_card_outline_text,
      outlineIcon:          settings?.product_card_outline_icon,
      outlineBg:            settings?.product_card_outline_bg,
      buttonFontSize:       settings?.product_card_button_font_size
                              ? parseInt(settings.product_card_button_font_size, 10) || 10
                              : undefined,
      layout:               settings?.product_card_layout,
      showShortDescription: settings?.product_card_show_short_description === "true",
      hideButtons:          settings?.product_card_hide_buttons === "true",
    }),
    [settings],
  );

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
              <ProductCard
                key={item.id}
                product={item.products}
                {...cardProps}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
