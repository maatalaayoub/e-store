"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CartSidebar from "@/components/ui/CartSidebar";
import ShopHeader from "@/components/shop/ShopHeader";
import HeroRenderer from "@/components/shop/HeroRenderer";
import FeaturedProducts from "@/components/shop/FeaturedProducts";
import ShopPerks from "@/components/shop/ShopPerks";
import ShopFooter from "@/components/shop/ShopFooter";
import { useBfcacheReload } from "@/hooks/useBfcacheReload";
import { HeroCarouselSkeleton } from "@/components/skeletons";

// Module-level cache: persists across client-side navigations, cleared on hard refresh
const _heroCache = new Map();

export default function HomePage() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const params = useParams();
  const locale = params?.locale || "en";
  const [heroData, setHeroData] = useState(() => _heroCache.get(locale) ?? null);
  const [heroLoading, setHeroLoading] = useState(() => !_heroCache.has(locale));

  useBfcacheReload();

  useEffect(() => {
    fetch("/api/v1/hero-slides")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const slides = (json.data ?? []).map((s) => ({
            image:        s.image_url,
            title:        s.title,
            cta:          s.cta_text,
            href:         s.href?.startsWith("http") ? s.href : `/${locale}${s.href ?? "/shop"}`,
            translations: s.translations ?? {},
          }));
          const data = {
            type: json.hero_type || "slider",
            config: json.config ?? null,
            slides,
          };
          _heroCache.set(locale, data);
          setHeroData(data);
        }
      })
      .catch(() => {})
      .finally(() => setHeroLoading(false));
  }, [locale]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900">
      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <ShopHeader onOpenCart={() => setIsCartOpen(true)} fixed={heroData?.type !== 'iherb'} />

      <main className="flex-1">
        {heroLoading ? (
          <HeroCarouselSkeleton />
        ) : (
          <HeroRenderer
            heroType={heroData?.type ?? "slider"}
            slides={heroData?.slides ?? []}
            heroConfig={heroData?.config}
            locale={locale}
          />
        )}
        <FeaturedProducts />
        <ShopPerks />
      </main>

      <ShopFooter />
    </div>
  );
}

