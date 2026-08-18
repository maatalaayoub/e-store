"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  X,
  Package,
  Star,
  Tag,
  Palette,
  Ruler,
  Calendar,
  Pencil,
  ExternalLink,
  Loader2,
  Boxes,
  Percent,
} from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { buildDisplayAttributes } from "@/lib/product-attributes";

const STATUS_STYLES = {
  active: { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  draft: { pill: "bg-zinc-100 text-zinc-600 border-zinc-200", dot: "bg-zinc-400" },
  archived: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
};

const LOW_STOCK_THRESHOLD = 5;
function getStockTone(stock) {
  const n = Number(stock);
  if (!Number.isFinite(n) || n <= 0) {
    return { label: "out", cls: "text-red-700 bg-red-50 border-red-200" };
  }
  if (n <= LOW_STOCK_THRESHOLD) {
    return { label: "low", cls: "text-amber-700 bg-amber-50 border-amber-200" };
  }
  return { label: "ok", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" };
}

function formatPrice(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(2)} DH`;
}

function formatDate(iso, locale) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(locale);
  } catch {
    return iso;
  }
}

export default function ProductDetailDrawer({ product, onClose, onEdit }) {
  const dict = useDictionary();
  const params = useParams();
  const locale = params?.locale || "en";

  const t = dict?.admin?.products ?? {};
  const tD = t.detail ?? {};
  const tTabs = t.tabs ?? {};

  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState(product);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Sync incoming product prop (opening a new one from the list)
  useEffect(() => {
    setSnapshot(product);
    setDetail(null);
    setActiveImageIdx(0);
    setLoadingDetail(!!product);
  }, [product]);

  // Slide-in animation
  useEffect(() => {
    if (!product) {
      setOpen(false);
      return;
    }
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, [product]);

  // Lazy-fetch the full product record (long description, all images, etc.).
  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    setLoadingDetail(true);
    fetch(`/api/v1/products/${product.id}?locale=${encodeURIComponent(locale)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && json.data) setDetail(json.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id, locale]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(() => onClose?.(), 300);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    if (!product) return;
    const handler = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [product, handleClose]);

  const data = detail ?? snapshot;

  const images = useMemo(() => {
    const list = Array.isArray(data?.images)
      ? data.images
      : Array.isArray(data?.product_images)
        ? data.product_images
        : [];
    return [...list].sort((a, b) => {
      if (a?.is_main !== b?.is_main) return a?.is_main ? -1 : 1;
      return (a?.display_order ?? 0) - (b?.display_order ?? 0);
    });
  }, [data]);

  const colors = Array.isArray(data?.colors) ? data.colors : [];
  const sizes = Array.isArray(data?.sizes) ? data.sizes : [];

  if (!snapshot || typeof document === "undefined") return null;

  const status = data?.status ?? "draft";
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  const stockTone = getStockTone(data?.stock);
  const stockLabel =
    stockTone.label === "out"
      ? tD.stock_out ?? "Out of stock"
      : stockTone.label === "low"
        ? tD.stock_low ?? "Low stock"
        : tD.stock_ok ?? "In stock";

  const hasDiscount =
    data?.effective_price != null &&
    data?.price != null &&
    data.effective_price < data.price;

  const activeImage = images[activeImageIdx] ?? images[0] ?? null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[10001] bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ease-out ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`
          fixed z-[10002] bg-white shadow-2xl flex flex-col overflow-hidden transition-transform duration-300
          bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl
          sm:bottom-auto sm:top-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-full sm:max-w-lg sm:rounded-none
          ${open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"}
        `}
        style={{
          transitionTimingFunction: open
            ? "cubic-bezier(0.32,0.72,0,1)"
            : "cubic-bezier(0.72,0,0.68,1)",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-100">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              {tD.title ?? "Product"}
            </p>
            <h2 className="text-lg font-bold text-zinc-900 leading-tight truncate flex items-center gap-1.5">
              {data?.name || "—"}
              {data?.is_featured && (
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 shrink-0" />
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${statusStyle.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
              {tTabs[status] ?? status}
            </span>
            <button
              onClick={handleClose}
              className="hidden sm:flex p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              aria-label={tD.close ?? "Close"}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {/* Image gallery */}
          <div className="p-5 border-b border-zinc-50">
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-zinc-100 flex items-center justify-center">
              {activeImage?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeImage.url}
                  alt={data?.name ?? ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="h-10 w-10 text-zinc-300" />
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {images.map((img, i) => (
                  <button
                    key={img?.id ?? i}
                    type="button"
                    onClick={() => setActiveImageIdx(i)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition-all ${
                      i === activeImageIdx
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {img?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Package className="h-4 w-4 text-zinc-300" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Price + stock quick facts */}
          <div className="grid grid-cols-2 gap-3 px-5 py-4 border-b border-zinc-50">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                {tD.price ?? "Price"}
              </p>
              {hasDiscount ? (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-base font-bold text-zinc-900">
                    {formatPrice(data.effective_price)}
                  </span>
                  <span className="text-xs text-zinc-400 line-through">
                    {formatPrice(data.price)}
                  </span>
                  {data.badge && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-semibold px-1.5 py-0.5">
                      <Percent className="h-2.5 w-2.5" />
                      {data.badge.replace("-", "").replace("%", "")}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-base font-bold text-zinc-900">
                  {formatPrice(data?.price)}
                </span>
              )}
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${stockTone.cls}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-1">
                {tD.stock ?? "Stock"}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold">{Number(data?.stock ?? 0)}</span>
                <span className="text-[11px] font-medium">{stockLabel}</span>
              </div>
            </div>
          </div>

          {/* Category */}
          {data?.category && (
            <div className="px-5 py-3 border-b border-zinc-50 flex items-center gap-2 text-sm">
              <Tag className="h-4 w-4 text-zinc-400" />
              <span className="text-zinc-500">{tD.category ?? "Category"}:</span>
              <span className="font-medium text-zinc-800">{data.category}</span>
            </div>
          )}

          {/* Colors */}
          {colors.length > 0 && (
            <div className="px-5 py-3 border-b border-zinc-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2 flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                {tD.colors ?? "Colors"}
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c, i) => {
                  const name = typeof c === "string" ? c : c?.name ?? "";
                  const hex = typeof c === "object" ? c?.hex : null;
                  return (
                    <span
                      key={`${name}-${i}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700"
                    >
                      {hex && (
                        <span
                          className="h-3 w-3 rounded-full border border-zinc-300"
                          style={{ background: hex }}
                        />
                      )}
                      {name || "—"}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sizes */}
          {sizes.length > 0 && (
            <div className="px-5 py-3 border-b border-zinc-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2 flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5" />
                {tD.sizes ?? "Sizes"}
              </p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s, i) => (
                  <span
                    key={`${s}-${i}`}
                    className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700"
                  >
                    {String(s)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Type-specific attributes (schema-driven) */}
          {buildDisplayAttributes(data?.product_type, data?.attributes, dict).map((group) => (
            <div key={group.id} className="px-5 py-3 border-b border-zinc-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
                {group.label}
              </p>
              <dl className="space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.key} className="flex items-baseline justify-between gap-4">
                    <dt className="text-xs text-zinc-500 shrink-0">{item.label}</dt>
                    <dd className="text-sm font-medium text-zinc-800 text-end break-words">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}

          {/* Short description */}
          {data?.short_description && (
            <div className="px-5 py-3 border-b border-zinc-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">
                {tD.short_description ?? "Summary"}
              </p>
              <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">
                {data.short_description}
              </p>
            </div>
          )}

          {/* Long description */}
          <div className="px-5 py-3 border-b border-zinc-50">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">
              {tD.description ?? "Description"}
            </p>
            {loadingDetail && !detail?.description ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {tD.loading ?? "Loading…"}
              </div>
            ) : data?.description ? (
              <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">
                {data.description}
              </p>
            ) : (
              <p className="text-sm text-zinc-400 italic">
                {tD.no_description ?? "No description provided."}
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="px-5 py-3 border-b border-zinc-50 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Boxes className="h-3.5 w-3.5 text-zinc-300" />
              <span className="uppercase tracking-wide font-semibold text-zinc-400">
                {tD.id ?? "ID"}
              </span>
              <span className="font-mono text-zinc-600 truncate">{data?.id}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Calendar className="h-3.5 w-3.5 text-zinc-300" />
              <span className="uppercase tracking-wide font-semibold text-zinc-400">
                {tD.created_at ?? "Created"}
              </span>
              <span className="text-zinc-600">{formatDate(data?.created_at, locale)}</span>
            </div>
            {data?.updated_at && data.updated_at !== data.created_at && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Calendar className="h-3.5 w-3.5 text-zinc-300" />
                <span className="uppercase tracking-wide font-semibold text-zinc-400">
                  {tD.updated_at ?? "Updated"}
                </span>
                <span className="text-zinc-600">{formatDate(data.updated_at, locale)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-3 flex items-center gap-2">
          <Link
            href={`/${locale}/product/${data?.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            {tD.view_public ?? "View public page"}
          </Link>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            {tD.close ?? "Close"}
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(snapshot)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Pencil className="h-4 w-4" />
            {tD.edit ?? "Edit"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
