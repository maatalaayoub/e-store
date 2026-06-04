"use client";

import HeroCarousel from "./HeroCarousel";
import HeroSingleImage from "./HeroSingleImage";
import HeroMultiImage from "./HeroMultiImage";
import HeroVideo from "./HeroVideo";
import HeroCountdown from "./HeroCountdown";

/**
 * HeroRenderer
 * Selects the correct hero component based on the admin-configured hero type.
 * Falls back to the slider (HeroCarousel) for any unrecognised type so existing
 * stores continue working with zero migration.
 *
 * Props:
 *   heroType  — 'slider' | 'single' | 'multi' | 'video' | 'countdown'
 *   slides    — mapped slide array ({ image, title, cta, href })
 *   heroConfig — parsed JSON object from store_settings (null for slider type)
 */
export default function HeroRenderer({ heroType = "slider", slides = [], heroConfig = null, locale = "en" }) {
  switch (heroType) {
    case "single":
      return <HeroSingleImage config={heroConfig ?? {}} locale={locale} />;

    case "multi":
      return <HeroMultiImage config={heroConfig ?? {}} images={slides} locale={locale} />;

    case "video":
      return <HeroVideo config={heroConfig ?? {}} locale={locale} />;

    case "countdown":
      return <HeroCountdown config={heroConfig ?? {}} locale={locale} />;

    case "slider":
    default:
      return <HeroCarousel slides={slides} locale={locale} />;
  }
}
