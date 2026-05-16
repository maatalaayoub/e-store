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

export default function FeaturedProducts({ onItemAdded }) {
  const params = useParams();
  const locale = params?.locale || "en";
  const dict = useDictionary();
  const tHome = dict?.home ?? {};
  const [products, setProducts] = useState(() => _cache.get(locale) ?? null);
  const [buttonStyle, setButtonStyle] = useState(() => _dsCache?.product_card_button_style ?? null);
  const [filledBg, setFilledBg] = useState(() => _dsCache?.product_card_filled_bg ?? null);
  const [filledText, setFilledText] = useState(() => _dsCache?.product_card_filled_text ?? null);
  const [outlineBorder, setOutlineBorder] = useState(() => _dsCache?.product_card_outline_border ?? null);
  const [outlineText,   setOutlineText]   = useState(() => _dsCache?.product_card_outline_text ?? null);
  const [outlineIcon,   setOutlineIcon]   = useState(() => _dsCache?.product_card_outline_icon ?? null);
  const [outlineBg, setOutlineBg] = useState(() => _dsCache?.product_card_outline_bg ?? null);
  const [buttonFontSize, setButtonFontSize] = useState(() => parseInt(_dsCache?.product_card_button_font_size) || 10);
  const [layout, setLayout] = useState(() => _dsCache?.product_card_layout ?? null);
  const [itemsMobile,  setItemsMobile]  = useState(() => parseInt(_dsCache?.carousel_items_mobile)  || 2);
  const [itemsTablet,  setItemsTablet]  = useState(() => parseInt(_dsCache?.carousel_items_tablet)  || 3);
  const [itemsDesktop, setItemsDesktop] = useState(() => parseInt(_dsCache?.carousel_items_desktop) || 4);
  const [productsPerRow,   setProductsPerRow]   = useState(() => parseInt(_dsCache?.carousel_products_per_row) || 8);
  const [autoplay,         setAutoplay]         = useState(() => _dsCache ? _dsCache.carousel_autoplay !== 'false' : true);
  const [carouselInterval, setCarouselInterval] = useState(() => parseInt(_dsCache?.carousel_interval) || 3000);
  const [speed,            setSpeed]            = useState(() => parseInt(_dsCache?.carousel_speed) || 500);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    Promise.all([
      fetchFeaturedProducts({ signal: controller.signal, locale }),
      fetchDisplaySettings(),
    ]).then(([data, ds]) => {
      _cache.set(locale, data);
      _dsCache = ds;
      if (mounted) {
        setProducts(data);
        setButtonStyle(ds?.product_card_button_style ?? null);
        setFilledBg(ds?.product_card_filled_bg ?? null);
        setFilledText(ds?.product_card_filled_text ?? null);
        setOutlineBorder(ds?.product_card_outline_border ?? null);
        setOutlineText(ds?.product_card_outline_text ?? null);
        setOutlineIcon(ds?.product_card_outline_icon ?? null);
        setOutlineBg(ds?.product_card_outline_bg ?? null);
        setButtonFontSize(parseInt(ds?.product_card_button_font_size) || 10);
        setLayout(ds?.product_card_layout ?? null);
        setItemsMobile(parseInt(ds?.carousel_items_mobile)  || 2);
        setItemsTablet(parseInt(ds?.carousel_items_tablet)  || 3);
        setItemsDesktop(parseInt(ds?.carousel_items_desktop) || 4);
        setProductsPerRow(parseInt(ds?.carousel_products_per_row) || 8);
        setAutoplay(ds?.carousel_autoplay !== 'false');
        setCarouselInterval(parseInt(ds?.carousel_interval) || 3000);
        setSpeed(parseInt(ds?.carousel_speed) || 500);
      }
    }).catch(() => {});

    return () => { mounted = false; controller.abort(); };
  }, [locale]);

  if (!products) return <FeaturedProductsSkeleton />;

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
            buttonStyle={buttonStyle}
            filledBg={filledBg}
            filledText={filledText}
            outlineBorder={outlineBorder}
            outlineText={outlineText}
            outlineIcon={outlineIcon}
            outlineBg={outlineBg}
            buttonFontSize={buttonFontSize}
            layout={layout}
            itemsMobile={itemsMobile}
            itemsTablet={itemsTablet}
            itemsDesktop={itemsDesktop}
            productsPerRow={productsPerRow}
            autoplay={autoplay}
            interval={carouselInterval}
            speed={speed}
          />
        </div>
      </div>
    </section>
  );
}
