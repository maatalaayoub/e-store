"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Download, ArrowLeft, FileText } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { isRtlLocale } from "@/config/constants";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { toast } from "sonner";

// Module-level cache keyed by order id: persists across client-side navigations
const _cache = new Map();

export default function InvoicePage() {
  const { locale, id } = useParams();
  const dict = useDictionary();
  const t = dict?.invoice ?? {};
  const isRtl = isRtlLocale(locale);

  const [order, setOrder] = useState(() => _cache.get(id) ?? null);
  const [loading, setLoading] = useState(() => !_cache.has(id));
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/orders/${id}`)
      .then((r) => r.json())
      .then(({ success, data, error }) => {
        if (success && data) {
          _cache.set(id, data);
          setOrder(data);
        }
        else setError(error || "Order not found");
      })
      .catch((e) => setError(e?.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownload() {
    if (!order) return;
    setGenerating(true);
    try {
      await downloadInvoicePdf(order);
    } catch (e) {
      console.error("[Invoice PDF]", e);
      const msg = t.download_failed ?? "Failed to generate PDF";
      toast.error(msg);
      setError(e?.message ?? msg);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-500 text-sm">{t.loading ?? "Loading invoice..."}</div>
      </div>
    );
  }
  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-red-600 text-sm">{error ?? "Order not found"}</div>
        <Link href={`/${locale}`} className="text-blue-600 hover:underline text-sm">
          {t.go_home ?? "Go to home"}
        </Link>
      </div>
    );
  }

  const ship = order.shipping_address ?? {};
  const items = order.order_items ?? [];
  const created = new Date(order.created_at);
  const dateStr = created.toLocaleDateString(locale === "ar" || locale === "dr" ? "ar" : locale, {
    year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = created.toLocaleTimeString(locale === "ar" || locale === "dr" ? "ar" : locale, {
    hour: "2-digit", minute: "2-digit",
  });
  const shortId = order.order_number ? String(order.order_number) : order.id.slice(0, 8).toUpperCase();
  const currency = order.currency_code ?? "MAD";
  const rate = Number(order.exchange_rate ?? 1);

  return (
    <div className="min-h-screen bg-zinc-50 py-8" dir={isRtl ? "rtl" : "ltr"}>
      {/* Action bar */}
      <div className="mx-auto max-w-3xl px-4 mb-6 flex items-center justify-between">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.back ?? "Back"}
        </Link>
        <button
          onClick={handleDownload}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {generating ? (t.generating ?? "Generating…") : (t.download ?? "Download PDF")}
        </button>
      </div>

      {/* Preview */}
      <div className="mx-auto max-w-3xl bg-white border border-zinc-200 rounded-xl p-8 sm:p-10 shadow-sm">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
              <FileText className="h-6 w-6 text-zinc-700" />
              {t.title ?? "Invoice"}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">#{shortId}</p>
          </div>
          <div className={isRtl ? "text-left" : "text-right"}>
            <p className="text-xs uppercase tracking-wide text-zinc-400">{t.date ?? "Date"}</p>
            <p className="text-sm font-medium text-zinc-900">{dateStr}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{timeStr}</p>
          </div>
        </div>

        {/* Customer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-zinc-200">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
              {t.bill_to ?? "Billed To"}
            </p>
            <p className="text-sm font-medium text-zinc-900">{ship.full_name || "Guest"}</p>
            {ship.phone && <p className="text-sm text-zinc-600 mt-1">{ship.phone}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
              {t.ship_to ?? "Shipping Address"}
            </p>
            <p className="text-sm text-zinc-700">
              {[ship.address, ship.city, ship.state, ship.zip, ship.country]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        </div>

        {/* Items */}
        <div className="py-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className={`pb-3 font-medium ${isRtl ? "text-right" : "text-left"}`}>
                  {t.item ?? "Item"}
                </th>
                <th className="pb-3 font-medium text-center">{t.qty ?? "Qty"}</th>
                <th className={`pb-3 font-medium ${isRtl ? "text-left" : "text-right"}`}>
                  {t.price ?? "Price"}
                </th>
                <th className={`pb-3 font-medium ${isRtl ? "text-left" : "text-right"}`}>
                  {t.subtotal ?? "Subtotal"}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const unit = Number(item.unit_price) * rate;
                const lineTotal = unit * item.quantity;
                return (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className={`py-3 text-zinc-900 ${isRtl ? "text-right" : "text-left"}`}>
                      {item.products?.name ?? "Product"}
                    </td>
                    <td className="py-3 text-center text-zinc-700">{item.quantity}</td>
                    <td className={`py-3 text-zinc-700 ${isRtl ? "text-left" : "text-right"}`}>
                      {unit.toFixed(2)} {currency}
                    </td>
                    <td className={`py-3 font-medium text-zinc-900 ${isRtl ? "text-left" : "text-right"}`}>
                      {lineTotal.toFixed(2)} {currency}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="flex justify-end pt-4 border-t border-zinc-200">
          <div className="w-full sm:w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">{t.total ?? "Total"}</span>
              <span className="text-lg font-bold text-zinc-900">
                {(Number(order.total_amount) * rate).toFixed(2)} {currency}
              </span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>{t.status ?? "Status"}</span>
              <span className="capitalize">{order.status}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-10 pt-6 border-t border-zinc-100 text-center text-xs text-zinc-400">
          {t.thank_you ?? "Thank you for your purchase!"}
        </p>
      </div>
    </div>
  );
}
