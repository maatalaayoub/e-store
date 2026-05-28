"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { fetchFeaturedProducts } from "@/services/productsService";
import { FeaturedProductsSkeleton } from "@/components/skeletons";
import ProductCarousel from "./ProductCarousel";

// Module-level caches — keyed by locale for products, singleton for settings
const _cache = new Map();
let _dsCache = null;

function fetchDisplaySettings() {
  return fetch("/api/v1/display-settings")
    .then((r) => r.json())
    .then((json) => (json.success ? json.data : {}))
    .catch(() => ({}));
}

function deriveSettings(ds) {
  return {
    buttonStyle:           ds?.product_card_button_style ?? null,
    filledBg:              ds?.product_card_filled_bg ?? null,
    filledText:            ds?.product_card_filled_text ?? null,
    outlineBorder:         ds?.product_card_outline_border ?? null,
    outlineText:           ds?.product_card_outline_text ?? null,
    outlineIcon:           ds?.product_card_outline_icon ?? null,
    outlineBg:             ds?.product_card_outline_bg ?? null,
    buttonFontSize:        parseInt(ds?.product_card_button_font_size) || 10,
    layout:                ds?.product_card_layout ?? null,
    showShortDescription:  ds?.product_card_show_short_description === 'true',
    itemsMobile:           parseInt(ds?.carousel_items_mobile)  || 2,
    itemsTablet:           parseInt(ds?.carousel_items_tablet)  || 3,
    itemsDesktop:          parseInt(ds?.carousel_items_desktop) || 4,
    productsPerRow:        parseInt(ds?.carousel_products_per_row) || 8,
    autoplay:              ds ? ds.carousel_autoplay !== 'false' : true,
    carouselInterval:      parseInt(ds?.carousel_interval) || 3000,
    speed:                 parseInt(ds?.carousel_speed) || 500,
  };
}

export default function FeaturedProducts({ onItemAdded }) {
  const params = useParams();
  const locale = params?.locale || "en";
  const dict = useDictionary();
  const tHome = dict?.home ?? {};
  const [products, setProducts] = useState(() => _cache.get(locale) ?? null);
  // Collapse 18 useState calls into a single settings object \u2014 re-renders
  // only when the server response changes, not per individual field.
  const [settings, setSettings] = useState(() => deriveSettings(_dsCache));

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    Promise.all([
      fetchFeaturedProducts({ signal: controller.signal, locale }),
      fetchDisplaySettings(),
    ]).then(([data, ds]) => {
      if (!mounted) return;
      if (Array.isArray(data) && data.length > 0) {
        _cache.set(locale, data);
      }
      _dsCache = ds;
      setProducts(data);
      setSettings(deriveSettings(ds));
    }).catch(() => {});

    return () => { mounted = false; controller.abort(); };
  }, [locale]);

  if (!products) return <FeaturedProductsSkeleton />;
  if (products.length === 0) return null;

  return (
    <section
      id="featured"
      className="bg-white px-4 py-20 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">
              {tHome.featured_kicker}
            </p>
            <h2 className="text-3xl font-bold tracking-tight uppercase sm:text-4xl md:text-5xl">
              {tHome.featured_title}
            </h2>
          </div>
          <Link
            href={`/${locale}/shop`}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-900 border-b border-zinc-900 pb-0.5 hover:border-zinc-400 hover:text-zinc-500 transition-colors self-start sm:self-auto"
          >
            <span>{dict?.common?.view_all}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="-mx-4 overflow-x-clip sm:mx-0">
          <ProductCarousel
            products={products}
            onItemAdded={onItemAdded}
            buttonStyle={settings.buttonStyle}
            filledBg={settings.filledBg}
            filledText={settings.filledText}
            outlineBorder={settings.outlineBorder}
            outlineText={settings.outlineText}
            outlineIcon={settings.outlineIcon}
            outlineBg={settings.outlineBg}
            buttonFontSize={settings.buttonFontSize}
            layout={settings.layout}
            showShortDescription={settings.showShortDescription}
            itemsMobile={settings.itemsMobile}
            itemsTablet={settings.itemsTablet}
            itemsDesktop={settings.itemsDesktop}
            productsPerRow={settings.productsPerRow}
            autoplay={settings.autoplay}
            interval={settings.carouselInterval}
            speed={settings.speed}
          />
        </div>
      </div>
    </section>
  );
}
