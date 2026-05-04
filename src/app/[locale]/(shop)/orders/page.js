"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  ChevronRight,
  ChevronLeft,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useDictionary } from "@/components/providers/LocaleProvider";

const STATUS_CONFIG = {
  pending:    { Icon: Clock,         color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200" },
  processing: { Icon: Loader2,       color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" },
  shipped:    { Icon: Truck,         color: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-200" },
  delivered:  { Icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  cancelled:  { Icon: XCircle,       color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200" },
};

function getMainImage(product) {
  const images = product?.product_images ?? [];
  const main = images.find((i) => i.is_main) ?? images[0];
  return main?.url ?? null;
}

function OrderCard({ order, onCancel }) {
  const { formatPrice } = useCurrency();
  const dict = useDictionary();
  const tOrders = dict?.orders ?? {};
  const tStatus = tOrders.status ?? {};
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const STATUS_CONFIG = {
    pending:    { label: tStatus.pending    ?? "Pending",    Icon: Clock,         color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200" },
    processing: { label: tStatus.processing ?? "Processing", Icon: Loader2,       color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" },
    shipped:    { label: tStatus.shipped    ?? "Shipped",    Icon: Truck,         color: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-200" },
    delivered:  { label: tStatus.delivered  ?? "Delivered",  Icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
    cancelled:  { label: tStatus.cancelled  ?? "Cancelled",  Icon: XCircle,       color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200" },
  };
  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const statusLabel = tStatus[order.status] ?? order.status ?? "Pending";
  const StatusIcon = status.Icon;
  const date = new Date(order.created_at).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    setShowConfirm(false);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status: "cancelled" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onCancel(order.id);
    } catch {
      setCancelError(tOrders.cancel_failed ?? "Failed to cancel order. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100 bg-zinc-50">
        <div>
          <p className="text-xs text-zinc-400 font-medium mb-0.5">{tOrders.order_id ?? "Order ID"}</p>
          <p className="font-mono text-sm font-semibold text-zinc-700 truncate max-w-[180px]">#{order.order_number ?? order.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400 font-medium mb-0.5">{tOrders.date ?? "Date"}</p>
          <p className="text-sm text-zinc-700">{date}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400 font-medium mb-0.5">{tOrders.total ?? "Total"}</p>
          <p className="text-sm font-bold text-zinc-900">{formatPrice(order.total_amount)}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${status.color} ${status.bg} ${status.border}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {statusLabel}
        </span>
      </div>

      {/* Items */}
      <ul className="divide-y divide-zinc-100">
        {(order.order_items ?? []).map((item) => {
          const imgUrl = getMainImage(item.products);
          return (
            <li key={item.id} className="flex items-center gap-4 px-5 py-4">
              <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200">
                {imgUrl ? (
                  <Image src={imgUrl} alt={item.products?.name ?? ""} width={56} height={56} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Package className="h-6 w-6 text-zinc-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{item.products?.name ?? "Product"}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{tOrders.qty ?? "Qty"}: {item.quantity}</p>
              </div>
              <p className="text-sm font-semibold text-zinc-900 shrink-0">{formatPrice(item.unit_price)}</p>
            </li>
          );
        })}
      </ul>

      {/* Shipping */}
      {order.shipping_address && (
        <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-100">
          <p className="text-xs text-zinc-400 font-medium mb-1">{tOrders.shipped_to ?? "Shipped to"}</p>
          <p className="text-xs text-zinc-600">
            {[
              order.shipping_address.full_name,
              order.shipping_address.address,
              order.shipping_address.city,
              order.shipping_address.country,
            ].filter(Boolean).join(", ")}
          </p>
        </div>
      )}

      {/* Cancel — only for pending orders */}
      {order.status === "pending" && (
        <div className="px-5 py-3 border-t border-zinc-100">
          {cancelError && (
            <p className="mb-2 text-xs text-red-500">{cancelError}</p>
          )}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={cancelling}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="h-3.5 w-3.5" />
            {cancelling ? "…" : (tOrders.cancel_order ?? "Cancel Order")}
          </button>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      {showConfirm && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-zinc-900 text-base">{tOrders.cancel_confirm_title ?? "Cancel Order?"}</p>
              <p className="mt-1 text-sm text-zinc-500">{tOrders.cancel_confirm_desc ?? "This action cannot be undone. The order will be permanently cancelled."}</p>
            </div>
            <div className="flex w-full gap-3 pt-1">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                {tOrders.cancel_no ?? "Keep Order"}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                {tOrders.cancel_yes ?? "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function MyOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale ?? "en";
  const dict = useDictionary();
  const tOrders = dict?.orders ?? {};
  const isRtl = ["ar", "dr"].includes(locale);
  const NavChevron = isRtl ? ChevronLeft : ChevronRight;
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    fetch("/api/v1/orders/my", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return;
        if (json.success) setOrders(json.data ?? []);
        else if (json.error === "Unauthorized") router.push(`/${locale}/login`);
        else setError(tOrders.failed ?? "Failed to load orders.");
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (mounted) setError(tOrders.failed ?? "Failed to load orders.");
      });

    return () => { mounted = false; controller.abort(); };
  }, [locale, router]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900">
      <PageHeader title={tOrders.title ?? "My Orders"} />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 pt-20 pb-20">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{tOrders.title ?? "My Orders"}</h1>
          <p className="mt-1 text-sm text-zinc-500">{tOrders.subtitle ?? "Track and manage your purchases"}</p>
        </div>

        {/* States */}
        {!orders && !error && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-zinc-200 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-center text-red-600 text-sm">
            {error}
          </div>
        )}

        {orders && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100">
              <Package className="h-9 w-9 text-zinc-300" />
            </div>
            <p className="text-lg font-semibold text-zinc-700">{tOrders.empty_title ?? "No orders yet"}</p>
            <p className="text-sm text-zinc-400 text-center max-w-xs">
              {tOrders.empty_desc ?? "Once you place an order, it will appear here."}
            </p>
            <Link
              href={`/${locale}`}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
            >
              {tOrders.start_shopping ?? "Start Shopping"} <NavChevron className="h-4 w-4" />
            </Link>
          </div>
        )}

        {orders && orders.length > 0 && (
          <div className="flex flex-col gap-5">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onCancel={(id) => setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "cancelled" } : o))}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
