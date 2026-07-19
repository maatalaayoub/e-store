"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { isRtlLocale } from "@/config/constants";
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
    hideButtons:           ds?.product_card_hide_buttons === 'true',
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

  const isRtl = isRtlLocale(locale);
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section
      id="featured"
      className="bg-white px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-5 sm:mb-14 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="mb-2.5 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400 sm:mb-3">
              <span className="inline-block h-px w-6 bg-zinc-300" aria-hidden="true" />
              {tHome.featured_kicker}
            </p>
            <h2 className="text-[1.75rem] font-bold leading-[1.1] tracking-tight text-zinc-900 uppercase sm:text-4xl md:text-5xl">
              {tHome.featured_title}
            </h2>
          </div>
          <Link
            href={`/${locale}/shop`}
            className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-zinc-900 transition-colors hover:border-zinc-900 hover:bg-zinc-900 hover:text-white sm:self-auto"
          >
            <span>{dict?.common?.view_all}</span>
            <ArrowIcon
              aria-hidden="true"
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            />
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
            hideButtons={settings.hideButtons}
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
