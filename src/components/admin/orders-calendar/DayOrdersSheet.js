"use client";

/**
 * DayOrdersSheet
 *
 * Lists the orders that make up a given day's revenue. Bottom sheet on mobile,
 * right-side drawer on desktop — mirrors the existing OrderDrawer chrome.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight } from "lucide-react";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";
import { statusMeta, formatMadShort } from "./order-events";

export default function DayOrdersSheet({ open, onClose, date, orders = [], onOrderClick }) {
  const dict = useDictionary();
  const { locale, dir } = useLocale();
  const t = dict?.admin?.orders ?? {};
  const tCal = t.calendar ?? {};
  const tTabs = t.tabs ?? {};

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const dateLabel = date
    ? new Date(date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const total = orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const countLabel = (tCal.orders_count ?? "{count} orders").replace("{count}", orders.length);

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[10001] bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed z-[10002] bg-white shadow-2xl flex flex-col overflow-hidden transition-transform duration-300
          bottom-0 left-0 right-0 max-h-[85vh] rounded-t-[3px]
          sm:bottom-auto sm:top-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none
          ${open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"}`}
        style={{ transitionTimingFunction: open ? "cubic-bezier(0.32,0.72,0,1)" : "cubic-bezier(0.72,0,0.68,1)" }}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
          <div className="h-1 w-10 rounded-[3px] bg-zinc-200" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{tCal.revenue ?? "Revenue"}</p>
            <h2 className="truncate text-base font-bold text-zinc-900">{dateLabel}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {countLabel} · <span className="font-semibold text-emerald-700">{formatMadShort(total)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={dict?.common?.close ?? "Close"}
            className="shrink-0 rounded-[3px] p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {orders.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-zinc-400">{tCal.empty_title ?? "No orders"}</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {orders.map((o) => {
                const meta = statusMeta(o.status);
                const time = new Date(o.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
                const customer = o.shipping_address?.full_name ?? "Guest";
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => { onOrderClick?.(o.id); onClose?.(); }}
                      className="flex w-full items-center gap-3 px-5 py-3 text-start transition-colors hover:bg-zinc-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-900">#{o.order_number ?? o.id.slice(0, 8)}</p>
                        <p className="truncate text-xs text-zinc-500">{customer} · {time}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                        <span className={`h-1.5 w-1.5 rounded-[2px] ${meta.dot}`} />
                        {tTabs[o.status] ?? o.status}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-zinc-900">
                        {formatMadShort(o.total_amount)}
                      </span>
                      <ChevronRight className={`h-4 w-4 shrink-0 text-zinc-300 ${dir === "rtl" ? "rotate-180" : ""}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
