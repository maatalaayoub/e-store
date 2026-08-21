"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Search, Filter, Download, ShoppingCart, RefreshCw, ChevronDown, Check, X, MapPin, Phone, User, Package, Calendar, CheckCircle2, XCircle, Loader2, RotateCw, Tag, Square, CheckSquare, MinusSquare, Trash2, MessageCircle } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminOrdersSkeleton } from "@/components/skeletons";
import { useAdminOrderView } from "@/components/providers/AdminOrderViewContext";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { toast } from "sonner";
import { resolveCategoryName } from "@/lib/category-locale";
import { resolveProductTranslation } from "@/lib/product-locale";

const TAB_KEYS = ["all", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

const STATUS_STYLES = {
  pending:    { pill: "bg-amber-50  text-amber-700  border-amber-200",  dot: "bg-amber-400"   },
  confirmed:  { pill: "bg-blue-50   text-blue-700   border-blue-200",   dot: "bg-blue-500"    },
  processing: { pill: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500"  },
  shipped:    { pill: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500"  },
  delivered:  { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  cancelled:  { pill: "bg-red-50   text-red-700    border-red-200",     dot: "bg-red-400"     },
};

const STATUS_OPTIONS = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

/* ── Custom status dropdown (portal-based to escape overflow-hidden/auto parents) ── */
function StatusSelect({ value, disabled, onChange, labels = {} }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, flipUp: false });
  const btnRef = useRef(null);
  const style = STATUS_STYLES[value] ?? { pill: "bg-zinc-100 text-zinc-700 border-zinc-200", dot: "bg-zinc-400" };
  const label = (s) => labels[s] ?? (s.charAt(0).toUpperCase() + s.slice(1));

  const openDropdown = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) { setOpen(true); return; }

    const GAP = 8;
    const DROPDOWN_H = 222; // 6 options × ~32px + padding
    const scrollContainer = document.querySelector("[data-scroll-main]");

    // First try to scroll the container so the dropdown fits below
    const overflow = rect.bottom + GAP + DROPDOWN_H - window.innerHeight + 16;
    if (overflow > 0 && scrollContainer) {
      const canScroll = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
      scrollContainer.scrollTop += Math.min(overflow, canScroll);
    }

    // Re-measure after scroll
    const r = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const isRtl = document.documentElement.dir === "rtl";
    const panelWidth = 170;
    const left = isRtl ? r.left : r.right - panelWidth;

    // Flip above only when there is genuinely not enough room below
    const flipUp = spaceBelow < DROPDOWN_H + GAP;
    const top = flipUp ? r.top - DROPDOWN_H - GAP : r.bottom + GAP;

    setCoords({ top, left, width: panelWidth, flipUp });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={openDropdown}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity disabled:opacity-60 disabled:cursor-not-allowed ${style.pill}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
        <span>{label(value)}</span>
        {!disabled && <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && !disabled && createPortal(
        <div
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width, zIndex: 9999 }}
          className="rounded-xl border border-zinc-100 bg-white shadow-xl py-1.5 pb-2"
        >
          {STATUS_OPTIONS.map((s) => {
            const st = STATUS_STYLES[s] ?? { dot: "bg-zinc-400" };
            return (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors hover:bg-zinc-50 ${s === value ? "text-zinc-900" : "text-zinc-600"}`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${st.dot}`} />
                <span className="flex-1 text-left">{label(s)}</span>
                {s === value && <Check className="h-3 w-3 text-zinc-400 shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

const DATE_RANGE_OPTIONS = ["all", "today", "week", "month"];
const CANCELLED_BY_OPTIONS = ["any", "customer", "admin"];

/* ── Order detail drawer ──────────────────────────────────────────────────── */
function OrderDrawer({ order, onClose, onStatusChanged }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState(null);   // basic header info (available instantly)
  const [detail, setDetail] = useState(null);        // full detail including items
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [changeMenuOpen, setChangeMenuOpen] = useState(false);
  const [changeCoords, setChangeCoords] = useState({ top: 0, left: 0, width: 0 });
  const changeBtnRef = useRef(null);

  const dict = useDictionary();
  const tD = dict?.admin?.orders?.drawer ?? {};
  const tH = dict?.admin?.orders?.headers ?? {};
  const tTabs = dict?.admin?.orders?.tabs ?? {};
  const promoAppliedLabel = dict?.admin?.orders?.promo_applied ?? "Promo code applied";
  const params = useParams();
  const locale = params?.locale || "en";

  // Open immediately when order is set; fetch full detail in background
  useEffect(() => {
    if (order) {
      setSnapshot(order);
      setDetail(null);
      setLoadingDetail(true);
      // Open right away — no rAF delay
      setOpen(true);
      // Fetch full order detail (fresh, includes items)
      fetch(`/api/v1/orders?id=${order.id}`)
        .then((r) => r.json())
        .then((json) => { if (json.success) setDetail(json.data); })
        .catch(() => {})
        .finally(() => setLoadingDetail(false));
    } else {
      setOpen(false);
      const t = setTimeout(() => { setSnapshot(null); setDetail(null); }, 300);
      return () => clearTimeout(t);
    }
  }, [order]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  /**
   * PATCH the order to a new status. Optimistically updates the local drawer
   * view and delegates to `onStatusChanged` so the parent list stays in sync.
   * Toasts on failure; the parent handles list refresh on success.
   */
  const handleUpdateStatus = useCallback(async (nextStatus) => {
    const target = snapshot;
    if (!target || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update order");
      }
      const patched = {
        status: nextStatus,
        cancelled_by: nextStatus === "cancelled" ? "admin" : null,
      };
      setSnapshot((prev) => (prev ? { ...prev, ...patched } : prev));
      setDetail((prev) => (prev ? { ...prev, ...patched } : prev));
      onStatusChanged?.(target.id, nextStatus, patched);
      toast.success(tD.status_updated ?? "Order updated");
    } catch (err) {
      toast.error(err?.message || "Failed to update order");
    } finally {
      setSubmitting(false);
      setPendingCancel(false);
      setChangeMenuOpen(false);
    }
  }, [snapshot, submitting, onStatusChanged, tD.status_updated]);

  // Send the customer a WhatsApp message with a secure invoice link.
  const handleSendInvoice = useCallback(async () => {
    const target = snapshot;
    if (!target || sendingInvoice) return;
    setSendingInvoice(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${target.id}/send-invoice`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "invoice_send_failed");
      toast.success(tD.invoice_sent ?? "Invoice sent via WhatsApp");
    } catch (err) {
      const map = tD.invoice_errors ?? {};
      toast.error(map[err.message] ?? (tD.invoice_send_failed ?? "Failed to send invoice"));
    } finally {
      setSendingInvoice(false);
    }
  }, [snapshot, sendingInvoice, tD]);

  // Close the "Change status" popover on outside click.
  useEffect(() => {
    if (!changeMenuOpen) return;
    const handler = (e) => {
      if (changeBtnRef.current && !changeBtnRef.current.contains(e.target)) {
        setChangeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [changeMenuOpen]);

  const openChangeMenu = () => {
    const rect = changeBtnRef.current?.getBoundingClientRect();
    if (!rect) { setChangeMenuOpen((v) => !v); return; }
    const GAP = 8;
    const PANEL_W = 200;
    const PANEL_H = 220;
    const isRtl = document.documentElement.dir === "rtl";
    const left = isRtl
      ? Math.max(8, rect.left)
      : Math.max(8, rect.right - PANEL_W);
    // Always flip above the footer button (footer sits at the bottom).
    const top = Math.max(8, rect.top - PANEL_H - GAP);
    setChangeCoords({ top, left, width: PANEL_W });
    setChangeMenuOpen(true);
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  if (!snapshot || typeof document === "undefined") return null;

  // Use fetched detail when available, fall back to the list snapshot
  const data = detail ?? snapshot;
  const addr = data.shipping_address ?? {};
  const items = data.order_items ?? [];
  const date = new Date(data.created_at).toLocaleString();
  const style = STATUS_STYLES[data.status] ?? { pill: "bg-zinc-100 text-zinc-700 border-zinc-200", dot: "bg-zinc-400" };
  const total = Number(data.total_amount ?? 0).toFixed(2);
  const promoDiscount = Number(data.promo_discount_amount ?? 0);
  const hasPromo = promoDiscount > 0;
  const originalTotal = (Number(data.total_amount ?? 0) + promoDiscount).toFixed(2);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[10001] bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ease-out ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={handleClose}
      />

      {/*
        Mobile  → bottom sheet: slides up from bottom, rounded top corners, max 85vh
        Desktop → side drawer:  slides in from right, full height, max-w-md
      */}
      <div
        className={`
          fixed z-[10002] bg-white shadow-2xl flex flex-col overflow-hidden transition-transform duration-300
          bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl
          sm:bottom-auto sm:top-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none
          ${open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"}
        `}
        style={{ transitionTimingFunction: open ? "cubic-bezier(0.32,0.72,0,1)" : "cubic-bezier(0.72,0,0.68,1)" }}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{tH.order ?? "Order"}</p>
            <h2 className="text-lg font-bold text-zinc-900 leading-tight inline-flex items-center gap-2 flex-wrap">
              #{snapshot.order_number ?? snapshot.id.slice(0, 8)}
              {data.promo_code_id && (
                <Link
                  href={`/${locale}/admin/marketing?promo=${data.promo_code_id}`}
                  className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                  title={promoAppliedLabel}
                >
                  <Tag className="h-3 w-3" />
                  {data.promo_codes?.code ?? ""}
                </Link>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${style.pill}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              {tTabs[data.status] ?? data.status}
            </span>
            <button
              onClick={handleClose}
              className="hidden sm:flex p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
          {/* Date */}
          <div className="px-5 py-4 border-b border-zinc-50 flex items-center gap-2 text-sm text-zinc-500">
            <Calendar className="h-4 w-4 text-zinc-300" />
            {date}
          </div>

          {/* Customer */}
          <div className="px-5 py-4 border-b border-zinc-100">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">{tH.customer ?? "Customer"}</p>
            <div className="flex flex-col gap-2">
              {addr.full_name && (
                <div className="flex items-start gap-2.5 text-sm text-zinc-700">
                  <User className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                  <span className="font-medium">{addr.full_name}</span>
                </div>
              )}
              {addr.phone && (
                <div className="flex items-start gap-2.5 text-sm text-zinc-700">
                  <Phone className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                  <span dir="ltr">{addr.phone}</span>
                </div>
              )}
              {(addr.address || addr.city || addr.country) && (
                <div className="flex items-start gap-2.5 text-sm text-zinc-700">
                  <MapPin className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                  <span>{[addr.address, addr.city, addr.state, addr.country].filter(Boolean).join(", ")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">{tD.items ?? "Items"}</p>
            {loadingDetail ? (
              /* Skeleton */
              <ul className="flex flex-col gap-2">
                {[1, 2].map((n) => (
                  <li key={n} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-4 py-3 animate-pulse">
                    <div className="h-7 w-7 rounded-lg bg-zinc-200 shrink-0" />
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="h-3 w-2/3 rounded bg-zinc-200" />
                      <div className="h-2.5 w-1/2 rounded bg-zinc-100" />
                    </div>
                    <div className="h-3 w-12 rounded bg-zinc-200 shrink-0" />
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <p className="text-sm text-zinc-400">{tD.no_items ?? "No items found."}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item, i) => {
                  const rawProduct = item.products ?? null;
                  const localized = rawProduct ? resolveProductTranslation(rawProduct, locale) : null;
                  const name = localized?.name ?? `Product #${i + 1}`;
                  const categoryName = rawProduct?.categories
                    ? resolveCategoryName(rawProduct.categories, locale)
                    : null;
                  // Pick the main image, else the lowest display_order, else any.
                  const images = Array.isArray(rawProduct?.product_images) ? rawProduct.product_images : [];
                  const mainImage = images.find((img) => img?.is_main)
                    ?? [...images].sort((a, b) => (a?.display_order ?? 0) - (b?.display_order ?? 0))[0]
                    ?? null;
                  const imageUrl = mainImage?.url ?? null;
                  const subtotal = (Number(item.unit_price ?? 0) * Number(item.quantity ?? 1)).toFixed(2);
                  const colorName = item.selected_color?.name ?? null;
                  const colorHex  = item.selected_color?.hex ?? null;
                  const sizeLabel = item.selected_size ?? null;
                  return (
                    <li key={i} className="flex items-start justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-12 w-12 shrink-0 rounded-lg object-cover bg-zinc-200"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-500">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{name}</p>
                          {categoryName && (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-zinc-500">
                              <Tag className="h-3 w-3 text-zinc-400" />
                              <span className="truncate">{categoryName}</span>
                            </p>
                          )}
                          <p className="text-xs text-zinc-400 mt-0.5">{tD.qty ?? "Qty"}: {item.quantity} &times; {Number(item.unit_price ?? 0).toFixed(2)} DH</p>
                          {(colorName || sizeLabel) && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
                              {colorName && (
                                <span className="inline-flex items-center gap-1.5">
                                  {colorHex && (
                                    <span
                                      aria-hidden="true"
                                      className="inline-block h-3 w-3 rounded-full border border-zinc-200"
                                      style={{ backgroundColor: colorHex }}
                                    />
                                  )}
                                  <span>{tD.color ?? "Color"}: <span className="font-medium text-zinc-800">{colorName}</span></span>
                                </span>
                              )}
                              {sizeLabel && (
                                <span>{tD.size ?? "Size"}: <span className="font-medium text-zinc-800">{sizeLabel}</span></span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-zinc-900 whitespace-nowrap shrink-0">{subtotal} DH</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Footer: total + status actions */}
        <div className="border-t border-zinc-100 bg-zinc-50">
          {hasPromo && (
            <div className="px-5 pt-3 flex items-center justify-between text-xs">
              <span className="text-zinc-500">{tD.subtotal ?? "Subtotal"}</span>
              <span className="text-zinc-600">{originalTotal} DH</span>
            </div>
          )}
          {hasPromo && (
            <div className="px-5 pt-1 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Tag className="h-3 w-3" />
                {tD.promo_discount ?? "Promo discount"}
              </span>
              <span className="text-emerald-600">−{promoDiscount.toFixed(2)} DH</span>
            </div>
          )}
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-500">{tH.total ?? "Total"}</span>
            <span className="text-lg font-bold text-zinc-900">{total} DH</span>
          </div>
          <div className="px-5 pb-3">
            <button
              type="button"
              disabled={sendingInvoice}
              onClick={handleSendInvoice}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-white px-3 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {sendingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              <span>{tD.send_invoice_whatsapp ?? "Send invoice via WhatsApp"}</span>
            </button>
          </div>
          {(() => {
            const status = data.status;
            if (status === "cancelled") {
              return (
                <div className="px-5 pb-4">
                  <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>
                      {tD.cancelled_note ?? "This order has been cancelled."}
                      {data.cancelled_by ? ` (${data.cancelled_by})` : ""}
                    </span>
                  </div>
                </div>
              );
            }
            if (status === "pending") {
              return (
                <div className="px-5 pb-4 pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setPendingCancel(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>{tD.cancel ?? "Cancel"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleUpdateStatus("confirmed")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    <span>{tD.confirm ?? "Confirm order"}</span>
                  </button>
                </div>
              );
            }
            return (
              <div className="px-5 pb-4 pt-1 flex items-center gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setPendingCancel(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  <span>{tD.cancel ?? "Cancel"}</span>
                </button>
                <button
                  ref={changeBtnRef}
                  type="button"
                  disabled={submitting}
                  onClick={openChangeMenu}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4" />
                  )}
                  <span>{tD.change_status ?? "Change status"}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${changeMenuOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Change-status popover (portal) */}
      {changeMenuOpen && !submitting && createPortal(
        <div
          style={{ position: "fixed", top: changeCoords.top, left: changeCoords.left, width: changeCoords.width, zIndex: 10003 }}
          className="rounded-xl border border-zinc-100 bg-white shadow-xl py-1.5"
        >
          {STATUS_OPTIONS
            .filter((s) => s !== data.status && s !== "cancelled")
            .map((s) => {
              const st = STATUS_STYLES[s] ?? { dot: "bg-zinc-400" };
              return (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleUpdateStatus(s); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${st.dot}`} />
                  <span className="flex-1 text-left">{tTabs[s] ?? s}</span>
                </button>
              );
            })}
        </div>,
        document.body,
      )}

      {/* Cancel confirmation */}
      <ConfirmationDialog
        isOpen={pendingCancel}
        title={tD.cancel_confirm_title ?? "Cancel this order?"}
        description={tD.cancel_confirm_desc ?? "Stock committed for this order will be restored. This action cannot be undone."}
        confirmText={tD.cancel_confirm_yes ?? "Cancel order"}
        cancelText={tD.cancel_confirm_no ?? "Keep order"}
        isDangerous
        isLoading={submitting}
        onConfirm={() => handleUpdateStatus("cancelled")}
        onCancel={() => setPendingCancel(false)}
      />
    </>,
    document.body
  );
}

export default function AdminOrdersPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCoords, setFilterCoords] = useState({ top: 0, left: 0 });
  const [dateRange, setDateRange] = useState("all");
  const [cancelledBy, setCancelledBy] = useState("any");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const filterBtnRef = useRef(null);
  const filterPanelRef = useRef(null);

  const dict = useDictionary();
  const t = dict?.admin?.orders ?? {};
  const tStats = t.stats ?? {};
  const tTabs = t.tabs ?? {};
  const tH = t.headers ?? {};
  const params = useParams();
  const locale = params?.locale || "en";
  const { pendingOrderId, clearPendingOrder } = useAdminOrderView();

  /* ── Open order drawer when another admin view requests it (e.g. a
     notification was clicked, or a linked-orders click from the products
     page). The id is passed through React context, never the URL or storage,
     so closing + refreshing cannot reopen it. Also scrolls the row into
     view so the admin can see which order was selected. */
  useEffect(() => {
    if (!pendingOrderId || orders.length === 0) return;
    const order = orders.find((o) => o.id === pendingOrderId);
    if (!order) return;
    setSelectedOrder(order);
    // If current filters would hide the row, reset them so it becomes visible.
    if (activeTab !== "all" && order.status !== activeTab) setActiveTab("all");
    if (search) setSearch("");
    if (dateRange !== "all") setDateRange("all");
    if (cancelledBy !== "any") setCancelledBy("any");
    // Defer scroll to next frame so the row is mounted after any tab switch.
    const id = pendingOrderId;
    requestAnimationFrame(() => {
      const el = document.getElementById(`order-row-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [pendingOrderId, orders, activeTab, search, dateRange, cancelledBy]);

  const closeOrderDrawer = useCallback(() => {
    setSelectedOrder(null);
    clearPendingOrder();
  }, [clearPendingOrder]);

  /**
   * Called by the drawer after a successful status PATCH. Keeps the underlying
   * list in sync so the row's inline pill/tabs reflect the change without a
   * full refetch.
   */
  const handleDrawerStatusChanged = useCallback((orderId, nextStatus, patch) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, ...patch, status: nextStatus } : o))
    );
  }, []);

  /* ── Fetch orders + live MAD exchange rates in parallel ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, ratesRes] = await Promise.all([
        fetch("/api/v1/orders"),
        fetch("/api/v1/exchange-rate?base=MAD"),
      ]);
      const ordersJson = await ordersRes.json();
      const ratesJson  = await ratesRes.json().catch(() => ({}));
      if (ordersJson.success) setOrders(ordersJson.data ?? []);
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Update order status inline ── */
  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, status: newStatus, cancelled_by: newStatus === "cancelled" ? "admin" : null }
              : o
          )
        );
      }
    } finally {
      setUpdatingId(null);
    }
  };

  /* ── Price helpers ── */
  /** Base admin price is always in MAD (DH) */
  const formatMAD = (amount) => `${Number(amount ?? 0).toFixed(2)} DH`;

  /**
   * Show the customer-facing price using exchange_rate stored at order time.
   * exchange_rate = 1 MAD → customer currency
   */
  const formatCustomerCurrency = (totalMad, currencyCode, rate) => {
    if (!currencyCode || currencyCode === "MAD") return null;
    const converted = Number(totalMad ?? 0) * Number(rate ?? 1);
    return `≈ ${converted.toFixed(2)} ${currencyCode}`;
  };

  /* ── Stats ── */
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const shippedCount = orders.filter((o) => o.status === "shipped").length;

  const stats = [
    { label: tStats.total   ?? "Total Orders", value: orders.length.toString() },
    { label: tStats.pending ?? "Pending",       value: pendingCount.toString() },
    { label: tStats.shipped ?? "Shipped",       value: shippedCount.toString() },
    { label: tStats.revenue ?? "Revenue (DH)",  value: formatMAD(totalRevenue) },
  ];

  const tFp = t.filter_panel ?? {};

  /* ── Filter panel open/close ── */
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e) => {
      if (
        filterBtnRef.current && !filterBtnRef.current.contains(e.target) &&
        filterPanelRef.current && !filterPanelRef.current.contains(e.target)
      ) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  const openFilter = () => {
    if (filterOpen) { setFilterOpen(false); return; }
    const rect = filterBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const PANEL_H = 310;
      const GAP = 8;
      const scrollContainer = document.querySelector("[data-scroll-main]");
      const overflow = rect.bottom + GAP + PANEL_H - window.innerHeight + 16;
      if (overflow > 0 && scrollContainer) {
        const canScroll = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
        scrollContainer.scrollTop += Math.min(overflow, canScroll);
      }
      const r = filterBtnRef.current.getBoundingClientRect();
      const isRtl = document.documentElement.dir === "rtl";
      // position:fixed → pure viewport coords, no scrollX/Y
      const left = isRtl ? r.left : Math.max(8, r.right - 240);
      setFilterCoords({ top: r.bottom + GAP, left });
    }
    setFilterOpen(true);
  };

  const clearFilters = () => { setDateRange("all"); setCancelledBy("any"); };
  const activeFilterCount = (dateRange !== "all" ? 1 : 0) + (cancelledBy !== "any" ? 1 : 0);

  /* ── Bulk selection ── */
  // Clear selection whenever the visible list changes (tab / search / filters).
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, search, dateRange, cancelledBy]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json?.error || "Delete failed");
      }
      const removed = new Set(selectedIds);
      setOrders((prev) => prev.filter((o) => !removed.has(o.id)));
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      toast.success(t.deleted_selected ?? "Selected orders deleted");
    } catch (err) {
      toast.error(t.delete_failed ?? "Failed to delete orders");
      console.error("[delete orders]", err);
    } finally {
      setDeleting(false);
    }
  };

  /* ── Filtered list ── */
  const filtered = orders.filter((o) => {
    const matchTab = activeTab === "all" || o.status === activeTab;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      String(o.order_number ?? "").includes(q) ||
      o.id?.toLowerCase().includes(q) ||
      o.shipping_address?.full_name?.toLowerCase().includes(q) ||
      o.shipping_address?.country?.toLowerCase().includes(q);
    const now = Date.now();
    const created = new Date(o.created_at).getTime();
    const matchDate =
      dateRange === "all" ||
      (dateRange === "today" && now - created < 86400000) ||
      (dateRange === "week"  && now - created < 7 * 86400000) ||
      (dateRange === "month" && now - created < 30 * 86400000);
    const matchCancelledBy =
      cancelledBy === "any" ||
      (cancelledBy === "customer" && o.cancelled_by === "customer") ||
      (cancelledBy === "admin"    && o.cancelled_by === "admin");
    return matchTab && matchSearch && matchDate && matchCancelledBy;
  });

  // Tri-state select-all across the currently visible orders.
  const visibleIds = filtered.map((o) => o.id);
  const visibleSelectedCount = visibleIds.filter((id) => selectedIds.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visible = new Set(visibleIds);
      setSelectedIds((prev) => prev.filter((id) => !visible.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  if (!dict?.admin?.orders) return <AdminOrdersSkeleton />;

  return (
    <>
      <OrderDrawer order={selectedOrder} onClose={closeOrderDrawer} onStatusChanged={handleDrawerStatusChanged} />
      <ConfirmationDialog
        isOpen={bulkDeleteOpen}
        title={t.delete_selected_title ?? "Delete selected orders?"}
        description={t.delete_selected_desc ?? "This action cannot be undone."}
        confirmText={t.delete_selected ?? "Delete selected"}
        cancelText={t.drawer?.cancel ?? "Cancel"}
        onConfirm={deleteSelected}
        onCancel={() => setBulkDeleteOpen(false)}
        isLoading={deleting}
      />
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{t.title ?? "Orders"}</h1>
          <p className="text-sm text-zinc-500 mt-1">{t.subtitle ?? "Manage customer orders"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50">
            <Download className="h-4 w-4" />
            {t.export ?? "Export"}
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="rounded-xl border border-zinc-100 bg-white p-5">
            <p className="text-sm font-medium text-zinc-500 mb-1">{stat.label}</p>
            <h3 className="text-xl font-bold text-zinc-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* CARD */}
      <div className="rounded-xl border border-zinc-100 bg-white">
        <div className="flex flex-col gap-4 border-b border-zinc-100 px-4 sm:px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {TAB_KEYS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab ? "bg-blue-50 text-blue-600" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {tTabs[tab] ?? tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search ?? "Search orders…"}
                className="w-full sm:w-64 rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <button
              ref={filterBtnRef}
              onClick={openFilter}
              className={`relative flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                filterOpen || activeFilterCount > 0
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{dict?.common?.filter ?? "Filter"}</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Bulk-select controls */}
            <div className="flex items-center gap-1 border-l border-zinc-200 pl-2 ml-1">
              {/* Mobile-only select-all (desktop has one in the table header) */}
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={visibleIds.length === 0}
                title={allVisibleSelected ? (t.deselect ?? "Deselect") : (t.select_all ?? "Select all")}
                aria-label={allVisibleSelected ? (t.deselect ?? "Deselect") : (t.select_all ?? "Select all")}
                className={`sm:hidden flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  visibleSelectedCount > 0
                    ? "text-blue-600 hover:bg-blue-50"
                    : "text-zinc-500 hover:bg-zinc-100"
                }`}
              >
                {allVisibleSelected ? (
                  <CheckSquare className="h-5 w-5" />
                ) : someVisibleSelected ? (
                  <MinusSquare className="h-5 w-5" />
                ) : (
                  <Square className="h-5 w-5" />
                )}
              </button>
              {selectedIds.length > 0 && (
                <>
                  <span className="whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {selectedIds.length} {t.selected ?? "selected"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteOpen(true)}
                    title={t.delete_selected ?? "Delete selected"}
                    aria-label={t.delete_selected ?? "Delete selected"}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {filterOpen && typeof document !== "undefined" && createPortal(
              <div
                ref={filterPanelRef}
                style={{ position: "fixed", top: filterCoords.top, left: filterCoords.left, width: 240, zIndex: 9999 }}
                className="rounded-xl border border-zinc-200 bg-white shadow-xl p-4 flex flex-col gap-4"
              >
                {/* Date range */}
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{tFp.date_range ?? "Date range"}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DATE_RANGE_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setDateRange(opt)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          dateRange === opt
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        {{
                          all:   tFp.all_time ?? "All time",
                          today: tFp.today    ?? "Today",
                          week:  tFp.last_7   ?? "Last 7 days",
                          month: tFp.last_30  ?? "Last 30 days",
                        }[opt]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cancelled by */}
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{tFp.cancelled_by ?? "Cancelled by"}</p>
                  <div className="flex gap-1.5">
                    {CANCELLED_BY_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setCancelledBy(opt)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          cancelledBy === opt
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        {{ any: tFp.any ?? "Any", customer: tFp.customer ?? "Customer", admin: tFp.admin_cancel ?? "Admin" }[opt]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => { clearFilters(); setFilterOpen(false); }}
                    className="w-full text-xs font-medium text-red-500 hover:text-red-600 border-t border-zinc-100 pt-3 mt-1"
                  >
                    {tFp.clear ?? "Clear filters"}
                  </button>
                )}
              </div>,
              document.body
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="divide-y divide-zinc-100 px-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="py-4 flex gap-4 animate-pulse">
                <div className="h-4 w-24 bg-zinc-100 rounded" />
                <div className="h-4 w-32 bg-zinc-100 rounded" />
                <div className="h-4 w-20 bg-zinc-100 rounded ml-auto" />
              </div>
            ))}
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-3">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <p className="font-medium text-zinc-900 mb-1">{t.empty_title ?? "No orders yet"}</p>
            <p className="text-sm text-zinc-500">{t.empty_desc ?? "Orders placed by customers will appear here."}</p>
          </div>
        )}

        {/* MOBILE CARDS */}
        {!loading && filtered.length > 0 && (
          <ul className="divide-y divide-zinc-200 sm:hidden">
            {filtered.map((o) => {
              const customer = o.shipping_address?.full_name ?? "Guest";
              const date = new Date(o.created_at).toLocaleDateString();
              const customerAmt = formatCustomerCurrency(o.total_amount, o.currency_code, o.exchange_rate);
              return (
                <li key={o.id} id={`order-row-${o.id}`} className={`px-4 py-4 flex gap-3 cursor-pointer hover:bg-zinc-50 active:bg-zinc-100 transition-colors ${selectedIds.includes(o.id) ? "bg-blue-50/50" : ""}`} onClick={() => {
                  if (selectedIds.length > 0) { toggleSelect(o.id); return; }
                  setSelectedOrder(o);
                }}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selectedIds.includes(o.id)}
                    aria-label={selectedIds.includes(o.id) ? (t.deselect ?? "Deselect") : (t.select ?? "Select")}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(o.id); }}
                    className={`mt-0.5 flex-shrink-0 transition-colors ${
                      selectedIds.includes(o.id) ? "text-blue-600" : "text-zinc-400"
                    }`}
                  >
                    {selectedIds.includes(o.id) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                  </button>
                  <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-900 text-sm inline-flex items-center gap-1.5 flex-wrap">
                      #{o.order_number ?? o.id.slice(0, 8)}
                      {o.promo_code_id && (
                        <Link
                          href={`/${locale}/admin/marketing?promo=${o.promo_code_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                          title={t.promo_applied ?? "Promo code applied"}
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {o.promo_codes?.code ?? ""}
                        </Link>
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                    <div>
                      <span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">{tH.customer ?? "Customer"}</span>
                      {customer}
                    </div>
                    <div>
                      <span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">{tH.date ?? "Date"}</span>
                      {date}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                    <div>
                      {Number(o.promo_discount_amount ?? 0) > 0 && (
                        <span className="mr-1.5 text-xs text-zinc-400 line-through">
                          {formatMAD(Number(o.total_amount ?? 0) + Number(o.promo_discount_amount ?? 0))}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-zinc-900">{formatMAD(o.total_amount)}</span>
                      {customerAmt && <span className="ml-1.5 text-xs text-zinc-400">{customerAmt}</span>}
                    </div>
                    <StatusSelect
                      value={o.status}
                      disabled={updatingId === o.id || o.cancelled_by === "customer"}
                      onChange={(val) => handleStatusChange(o.id, val)}
                      labels={tTabs}
                    />
                  </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* DESKTOP TABLE */}
        {!loading && filtered.length > 0 && (
          <div className="hidden sm:block overflow-x-auto scrollbar-hide">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-white text-xs uppercase text-zinc-400 border-b border-zinc-100">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      disabled={visibleIds.length === 0}
                      aria-label={allVisibleSelected ? (t.deselect ?? "Deselect") : (t.select_all ?? "Select all")}
                      className={`flex items-center justify-center transition-colors disabled:opacity-40 ${
                        visibleSelectedCount > 0 ? "text-blue-600" : "text-zinc-400 hover:text-zinc-600"
                      }`}
                    >
                      {allVisibleSelected ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : someVisibleSelected ? (
                        <MinusSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 font-medium">{tH.order ?? "Order"}</th>
                  <th className="px-6 py-3 font-medium">{tH.customer ?? "Customer"}</th>
                  <th className="px-6 py-3 font-medium">{tH.date ?? "Date"}</th>
                  <th className="px-6 py-3 font-medium">Total (DH)</th>
                  <th className="px-6 py-3 font-medium">Customer Currency</th>
                  <th className="px-6 py-3 font-medium">{tH.status ?? "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((o) => {
                  const customer = o.shipping_address?.full_name ?? "Guest";
                  const country  = o.shipping_address?.country ?? "";
                  const date     = new Date(o.created_at).toLocaleDateString();
                  const customerAmt = formatCustomerCurrency(o.total_amount, o.currency_code, o.exchange_rate);
                  return (
                    <tr key={o.id} id={`order-row-${o.id}`} className={`hover:bg-zinc-50 cursor-pointer ${selectedIds.includes(o.id) ? "bg-blue-50/40" : ""}`} onClick={() => {
                      if (selectedIds.length > 0) { toggleSelect(o.id); return; }
                      setSelectedOrder(o);
                    }}>
                      <td className="w-10 px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={selectedIds.includes(o.id)}
                          aria-label={selectedIds.includes(o.id) ? (t.deselect ?? "Deselect") : (t.select ?? "Select")}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(o.id); }}
                          className={`flex items-center justify-center transition-colors ${
                            selectedIds.includes(o.id) ? "text-blue-600" : "text-zinc-400 hover:text-zinc-600"
                          }`}
                        >
                          {selectedIds.includes(o.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1.5">
                          #{o.order_number ?? o.id.slice(0, 8)}
                          {o.promo_code_id && (
                            <Link
                              href={`/${locale}/admin/marketing?promo=${o.promo_code_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                              title={t.promo_applied ?? "Promo code applied"}
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {o.promo_codes?.code ?? ""}
                            </Link>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-zinc-900">{customer}</span>
                        {country && <span className="ml-1.5 text-xs text-zinc-400">{country}</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{date}</td>
                      <td className="px-6 py-4 font-semibold text-zinc-900 whitespace-nowrap">
                        {Number(o.promo_discount_amount ?? 0) > 0 && (
                          <span className="mr-1.5 text-xs font-normal text-zinc-400 line-through">
                            {formatMAD(Number(o.total_amount ?? 0) + Number(o.promo_discount_amount ?? 0))}
                          </span>
                        )}
                        {formatMAD(o.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                        {customerAmt ?? <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <StatusSelect
                          value={o.status}
                          disabled={updatingId === o.id || o.cancelled_by === "customer"}
                          onChange={(val) => handleStatusChange(o.id, val)}
                          labels={tTabs}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
