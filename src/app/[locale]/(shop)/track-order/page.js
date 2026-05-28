"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Search,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Download,
} from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { isRtlLocale } from "@/config/constants";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import PageHeader from "@/components/ui/PageHeader";
import { TRACK_ORDER_STATUS_CONFIG as STATUS_CONFIG } from "@/lib/order-status";

export default function TrackOrderPage() {
  const { locale } = useParams();
  const dict = useDictionary();
  const t = dict?.track_order ?? {};
  const tProduct = dict?.product ?? {};
  const isRtl = isRtlLocale(locale);

  const [query, setQuery] = useState("");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    const id = query.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch(`/api/v1/orders/${encodeURIComponent(id)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setOrder(json.data);
      } else {
        setError(t.not_found ?? "No order found with that ID.");
      }
    } catch {
      setError(t.error ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!order || downloading) return;
    setDownloading(true);
    try {
      await downloadInvoicePdf(order);
    } catch (e) {
      console.error("[Download invoice]", e);
    } finally {
      setDownloading(false);
    }
  }

  const statusKey = order?.status ?? "pending";
  const { Icon: StatusIcon, color, bg, border } =
    STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;

  const currency = order?.currency_code ?? "MAD";
  const rate = Number(order?.exchange_rate ?? 1);
  const items = order?.order_items ?? [];
  const ship = order?.shipping_address ?? {};

  const created = order ? new Date(order.created_at) : null;
  const dateStr = created?.toLocaleDateString(
    locale === "ar" || locale === "dr" ? "ar" : locale,
    { year: "numeric", month: "long", day: "numeric" }
  );
  const timeStr = created?.toLocaleTimeString(
    locale === "ar" || locale === "dr" ? "ar" : locale,
    { hour: "2-digit", minute: "2-digit" }
  );

  return (
    <div
      className="min-h-screen bg-white"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <PageHeader title={t.title ?? "Track Your Order"} showCart={true} />

      <div className="pt-14 py-10 px-4">
      <div className="mx-auto max-w-xl">

        {/* Header */}
        <div className="mb-8 mt-4">
          <p className="mt-1 text-sm text-zinc-500">
            {t.subtitle ?? "Enter your order ID to check the current status."}
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.placeholder ?? "e.g. 47382910"}
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            {loading ? (t.searching ?? "…") : (t.submit ?? "Track")}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Result */}
        {order && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white overflow-hidden">
            {/* Status banner */}
            <div className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b ${bg} ${border}`}>
              <div className="flex items-center gap-3 flex-1">
                <StatusIcon className={`h-5 w-5 shrink-0 ${color}`} strokeWidth={1.5} />
                <div>
                  <p className="text-xs text-zinc-500">{t.status ?? "Status"}</p>
                  <p className={`text-sm font-semibold capitalize ${color}`}>
                    {t[`status_${statusKey}`] ?? statusKey}
                  </p>
                </div>
              </div>
              <div className={`sm:${isRtl ? "text-left" : "text-right"}`}>
                <p className="text-xs text-zinc-500">{t.date ?? "Date"}</p>
                <p className="text-sm font-medium text-zinc-800">{dateStr}</p>
                <p className="text-xs text-zinc-400">{timeStr}</p>
              </div>
            </div>

            {/* Order ID + customer */}
            <div className="px-5 py-4 border-b border-zinc-100 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">{t.order_id ?? "Order ID"}</p>
                <p className="text-sm font-mono font-medium text-zinc-800">
                  #{order.order_number ?? order.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              {ship.full_name && (
                <div>
                  <p className="text-xs text-zinc-400 mb-0.5">{t.customer ?? "Customer"}</p>
                  <p className="text-sm font-medium text-zinc-800">{ship.full_name}</p>
                </div>
              )}
              {ship.phone && (
                <div>
                  <p className="text-xs text-zinc-400 mb-0.5">{t.phone ?? "Phone"}</p>
                  <p className="text-sm text-zinc-700">{ship.phone}</p>
                </div>
              )}
              {ship.city && (
                <div>
                  <p className="text-xs text-zinc-400 mb-0.5">{t.city ?? "City"}</p>
                  <p className="text-sm text-zinc-700">
                    {[ship.city, ship.country].filter(Boolean).join(", ")}
                  </p>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="px-5 py-4 border-b border-zinc-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
                {t.items ?? "Items"}
              </p>
              <ul className="flex flex-col gap-2">
                {items.map((item, i) => {
                  const unit = Number(item.unit_price) * rate;
                  const colorName = item.selected_color?.name ?? null;
                  const colorHex = item.selected_color?.hex ?? null;
                  const sizeLabel = item.selected_size ?? null;
                  return (
                    <li key={i} className="flex items-start justify-between gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-800 truncate">
                          {item.products?.name ?? "Product"}
                        </p>
                        {(colorName || sizeLabel) && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                            {colorName && (
                              <span className="inline-flex items-center gap-1.5">
                                {colorHex && (
                                  <span
                                    aria-hidden="true"
                                    className="inline-block h-3 w-3 rounded-full border border-zinc-200"
                                    style={{ backgroundColor: colorHex }}
                                  />
                                )}
                                <span>{tProduct.color ?? "Color"}: <span className="font-medium text-zinc-700">{colorName}</span></span>
                              </span>
                            )}
                            {sizeLabel && (
                              <span>{tProduct.size ?? "Size"}: <span className="font-medium text-zinc-700">{sizeLabel}</span></span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-zinc-500 mx-3 shrink-0">× {item.quantity}</span>
                      <span className="font-medium text-zinc-900 shrink-0">
                        {(unit * item.quantity).toFixed(2)} {currency}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Total */}
            <div className="px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900">{t.total ?? "Total"}</span>
              <span className="text-lg font-bold text-zinc-900">
                {(Number(order.total_amount) * rate).toFixed(2)} {currency}
              </span>
            </div>

            {/* Download invoice */}
            <div className="px-5 pb-5">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 transition-colors"
              >
                <Download className="h-4 w-4" />
                {downloading
                  ? (t.downloading ?? "Downloading…")
                  : (t.download_invoice ?? "Download Invoice")}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
