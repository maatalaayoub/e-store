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
import { HeroSkeleton } from "@/components/skeletons";

// Module-level cache: persists across client-side navigations, cleared on hard refresh
const _heroCache = new Map();

export default function HomeClient() {
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
      {/*
        Hero layout mode for the header:
        - 'full' (slider / single / multi / video / countdown):
          hero renders behind the header on every breakpoint → header stays
          transparent + white icons until the user scrolls.
        - 'all'  (iHerb, or while hero data is still loading):
          hero renders below the header → header is fixed + solid light.
      */}
      <ShopHeader
        onOpenCart={() => setIsCartOpen(true)}
        fixedBelow={heroData?.type && heroData.type !== 'iherb' ? 'full' : 'all'}
      />

      <main className="flex-1">
        {heroLoading ? (
          <HeroSkeleton type={heroData?.type ?? "slider"} />
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
