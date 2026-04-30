"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import CartSidebar from "@/components/ui/CartSidebar";
import ShopHeader from "@/components/shop/ShopHeader";
import HeroCarousel from "@/components/shop/HeroCarousel";
import FeaturedProducts from "@/components/shop/FeaturedProducts";
import ShopPerks from "@/components/shop/ShopPerks";
import ShopFooter from "@/components/shop/ShopFooter";
import { useBfcacheReload } from "@/hooks/useBfcacheReload";
import { getHeroSlides } from "@/data/heroSlides";

export default function HomePage() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const params = useParams();
  const locale = params?.locale || "en";
  const slides = getHeroSlides(locale);

  useBfcacheReload();

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900">
      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <ShopHeader onOpenCart={() => setIsCartOpen(true)} />

      <main className="flex-1">
        <HeroCarousel slides={slides} />
        <FeaturedProducts />
        <ShopPerks />
      </main>

      <ShopFooter />
    </div>
  );
}
