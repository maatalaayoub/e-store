"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { isRtlLocale } from "@/config/constants";
import { fetchFeaturedProducts } from "@/services/productsService";
import { FeaturedProductsSkeleton } from "@/components/skeletons";
import { resolveCategoryName } from "@/lib/category-locale";
import ProductCarousel from "./ProductCarousel";

// Module-level caches — keyed by locale for products, singleton for settings
const _cache = new Map();
let _dsCache = null;
let _categoriesCache = null;

function fetchDisplaySettings() {
  return fetch("/api/v1/display-settings")
    .then((r) => r.json())
    .then((json) => (json.success ? json.data : {}))
    .catch(() => ({}));
}

function fetchCategoriesList() {
  return fetch("/api/v1/categories")
    .then((r) => r.json())
    .then((json) => (json?.success && Array.isArray(json.data) ? json.data : []))
    .catch(() => []);
}

/**
 * Groups products into category buckets while preserving first-seen order.
 * Products without a category are collected into a trailing "other" bucket so
 * they still render, just after the named categories. `categoriesMeta` (an
 * array of full category rows including `translations` + `image_url`) is used
 * to attach the localized display name and optional icon to each group.
 *
 * Grouping is keyed by `category_id` (stable across locales) rather than by
 * the localized name string — otherwise the same category would split into
 * multiple buckets when the language changes mid-render.
 */
function groupByCategory(products, otherLabel, categoriesMeta = [], locale) {
  const metaById = new Map();
  for (const c of categoriesMeta) {
    if (c?.id) metaById.set(c.id, c);
  }

  const map = new Map(); // category_id -> { name, image_url, items }
  const uncategorized = [];

  for (const product of products) {
    const catId = product?.category_id ?? null;
    if (!catId) {
      uncategorized.push(product);
      continue;
    }
    if (!map.has(catId)) {
      const meta = metaById.get(catId);
      const displayName =
        (meta && resolveCategoryName(meta, locale)) ||
        // Fallback to the product's already-normalised `category` string in
        // case the categories list hasn't loaded yet.
        (typeof product.category === "string" ? product.category : "") ||
        "";
      map.set(catId, {
        id: catId,
        name: displayName,
        image_url: meta?.image_url ?? null,
        items: [],
      });
    }
    map.get(catId).items.push(product);
  }

  const groups = Array.from(map.values());
  if (uncategorized.length) {
    groups.push({ id: "__other__", name: otherLabel, items: uncategorized, image_url: null });
  }
  return groups;
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
  const [categoriesMeta, setCategoriesMeta] = useState(() => _categoriesCache ?? []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    Promise.all([
      fetchFeaturedProducts({ signal: controller.signal, locale }),
      fetchDisplaySettings(),
      fetchCategoriesList(),
    ]).then(([data, ds, cats]) => {
      if (!mounted) return;
      if (Array.isArray(data) && data.length > 0) {
        _cache.set(locale, data);
      }
      _dsCache = ds;
      _categoriesCache = cats;
      setProducts(data);
      setSettings(deriveSettings(ds));
      setCategoriesMeta(cats);
    }).catch(() => {});

    return () => { mounted = false; controller.abort(); };
  }, [locale]);

  if (!products) return <FeaturedProductsSkeleton />;
  if (products.length === 0) return null;

  const isRtl = isRtlLocale(locale);
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const categoryGroups = groupByCategory(
    products,
    tHome.category_other ?? "More products",
    categoriesMeta,
    locale,
  );

  const carouselProps = {
    onItemAdded,
    buttonStyle:          settings.buttonStyle,
    filledBg:             settings.filledBg,
    filledText:           settings.filledText,
    outlineBorder:        settings.outlineBorder,
    outlineText:          settings.outlineText,
    outlineIcon:          settings.outlineIcon,
    outlineBg:            settings.outlineBg,
    buttonFontSize:       settings.buttonFontSize,
    layout:               settings.layout,
    showShortDescription: settings.showShortDescription,
    hideButtons:          settings.hideButtons,
    itemsMobile:          settings.itemsMobile,
    itemsTablet:          settings.itemsTablet,
    itemsDesktop:         settings.itemsDesktop,
    productsPerRow:       settings.productsPerRow,
    autoplay:             settings.autoplay,
    interval:             settings.carouselInterval,
    speed:                settings.speed,
  };

  return (
    <section
      id="featured"
      className="bg-white px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-7xl lg:max-w-none">
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

        <div className="flex flex-col gap-14 sm:gap-20">
          {categoryGroups.map((group) => (
            <div key={group.id}>
              {/* Professional category separator */}
              <div className="mb-7 flex items-center gap-4 sm:mb-9 sm:gap-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="h-6 w-1 shrink-0 rounded-full bg-zinc-900 sm:h-7"
                  />
                  {group.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={group.image_url}
                      alt=""
                      loading="lazy"
                      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-zinc-200 sm:h-11 sm:w-11"
                    />
                  )}
                  <h3 className="truncate text-lg font-bold uppercase tracking-tight text-zinc-900 sm:text-2xl">
                    {group.name}
                  </h3>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-500 sm:text-xs">
                    {group.items.length}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className="h-px flex-1 bg-gradient-to-r from-zinc-200 to-transparent rtl:bg-gradient-to-l"
                />
              </div>

              <div className="-mx-4 overflow-x-clip sm:mx-0">
                <ProductCarousel products={group.items} {...carouselProps} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
