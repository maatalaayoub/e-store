"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { fetchFeaturedProducts } from "@/services/productsService";
import { FeaturedProductsSkeleton } from "@/components/skeletons";
import ProductCard from "./ProductCard";

// Module-level cache for products only (keyed by locale)
const _cache = new Map();

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
  const [buttonStyle, setButtonStyle] = useState(null);
  const [filledBg, setFilledBg] = useState(null);
  const [filledText, setFilledText] = useState(null);
  const [outlineBorder, setOutlineBorder] = useState(null);
  const [outlineText,   setOutlineText]   = useState(null);
  const [outlineIcon,   setOutlineIcon]   = useState(null);
  const [outlineBg, setOutlineBg] = useState(null);
  const [buttonFontSize, setButtonFontSize] = useState(10);
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    Promise.all([
      fetchFeaturedProducts({ signal: controller.signal, locale }),
      fetchDisplaySettings(),
    ]).then(([data, ds]) => {
      _cache.set(locale, data);
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

        <div className="grid grid-cols-2 gap-x-4 gap-y-12 lg:grid-cols-4 xl:gap-x-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdded={onItemAdded}
              buttonStyle={buttonStyle}
              filledBg={filledBg}
              filledText={filledText}
              outlineBorder={outlineBorder}
              outlineText={outlineText}
              outlineIcon={outlineIcon}
              outlineBg={outlineBg}
              buttonFontSize={buttonFontSize}
              layout={layout}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
