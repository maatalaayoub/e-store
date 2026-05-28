"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, Phone, Package, Truck, Download } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { isRtlLocale } from "@/config/constants";
import { createClient } from "@/lib/supabase/client";
import { downloadInvoiceById } from "@/lib/invoice-pdf";
import { toast } from "sonner";

export default function OrderConfirmedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <OrderConfirmedInner />
    </Suspense>
  );
}

function OrderConfirmedInner() {
  const { locale } = useParams();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id");
  const dict = useDictionary();
  const t = dict?.order_confirmed ?? {};
  const isRtl = isRtlLocale(locale);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [orderNumber, setOrderNumber] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data?.user);
    });
  }, []);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/v1/orders/${encodeURIComponent(orderId)}`)
      .then((r) => r.json())
      .then(({ data }) => {
        if (data?.order_number) setOrderNumber(String(data.order_number));
      })
      .catch(() => {});
  }, [orderId]);

  async function handleDownload() {
    if (!orderId || downloading) return;
    setDownloading(true);
    try {
      await downloadInvoiceById(orderId);
    } catch (e) {
      console.error("[Download invoice]", e);
      toast.error(dict?.invoice?.download_failed ?? "Failed to download invoice.");
    } finally {
      setDownloading(false);
    }
  }

  const steps = [
    { Icon: Package, text: t.step1 ?? "Our team will review your order." },
    { Icon: Phone,   text: t.step2 ?? "We will call you to confirm availability and delivery." },
    { Icon: Truck,   text: t.step3 ?? "Your order will be prepared and shipped." },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-20" dir={isRtl ? "rtl" : "ltr"}>
      {/* Success icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 mb-6">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 text-center">
        {t.title ?? "Order Received!"}
      </h1>
      <p className="mt-3 text-sm sm:text-base text-zinc-500 text-center max-w-sm leading-relaxed">
        {t.subtitle ?? "Thank you for your order. We will call you shortly to confirm the details."}
      </p>

      {/* Order number badge */}
      {orderNumber && (
        <div className="mt-6 flex flex-col items-center gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            {t.order_number_label ?? "Order Number"}
          </p>
          <p className="text-2xl font-bold tracking-wide text-zinc-900">#{orderNumber}</p>
        </div>
      )}

      {/* Steps */}
      <div className="mt-10 w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4 text-center">
          {t.what_next ?? "What happens next?"}
        </p>
        <ol className="flex flex-col gap-3">
          {steps.map(({ Icon, text }, i) => (
            <li key={i} className="flex items-start gap-4 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700">
                {i + 1}
              </span>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Icon className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.5} />
                <span className="text-sm text-zinc-700">{text}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Download Invoice (primary action) */}
      {orderId && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="mt-10 w-full max-w-sm inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          <Download className="h-4 w-4" />
          {downloading
            ? (t.downloading ?? "Downloading…")
            : (t.download_invoice ?? "Download Invoice")}
        </button>
      )}

      {/* Secondary actions */}
      <div className={`mt-3 flex flex-col sm:flex-row gap-3 w-full max-w-sm ${orderId ? "" : "mt-10"}`}>
        {isLoggedIn && (
          <Link
            href={`/${locale}/orders`}
            className="flex-1 inline-flex items-center justify-center rounded-lg border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            {t.orders ?? "My Orders"}
          </Link>
        )}
        <Link
          href={`/${locale}`}
          className="flex-1 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
        >
          {t.continue ?? "Continue Shopping"}
        </Link>
      </div>
    </div>
  );
}
