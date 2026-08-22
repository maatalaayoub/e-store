"use client";

/**
 * OrdersCalendarContainer (Phase 3)
 *
 * Data layer for the reusable calendar. Fetches only the orders inside the
 * currently visible date range (via GET /api/v1/orders?from=&to=), maps them
 * to events, and renders them through OrdersCalendar. Reused by both the
 * Orders page and the Overview page — page-specific concerns (opening the
 * order drawer) are delegated through the `onOrderClick` callback.
 *
 * Props:
 *  - onOrderClick(orderId)  Called when an order event is clicked.
 *  - status                 Optional server-side status filter (single status).
 *  - initialView            "month" | "week" | "day".
 *  - height                 FullCalendar height.
 *  - onOrdersLoaded(orders) Optional — receive the raw orders for the range
 *                           (used by the Overview summary counts).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import OrdersCalendar from "./OrdersCalendar";
import DayOrdersSheet from "./DayOrdersSheet";
import { ordersToEvents, statusMeta, formatMadShort } from "./order-events";

// Short-lived module cache so toggling List↔Calendar or navigating back to a
// visited range doesn't refetch identical data. Entries expire after CACHE_TTL.
const CACHE_TTL = 60_000;
const CACHE_MAX = 50;
const rangeCache = new Map(); // key -> { ts, data }
function cacheKey(status, fromIso, toIso) {
  return `${status ?? "all"}|${fromIso}|${toIso}`;
}
function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export default function OrdersCalendarContainer({
  onOrderClick,
  status = null,
  search = "",
  cancelledBy = "any",
  initialView = "month",
  height = "auto",
  onOrdersLoaded,
  bare = false,
  mode = "orders",
}) {
  const dict = useDictionary();
  const tTabs = useMemo(() => dict?.admin?.orders?.tabs ?? {}, [dict]);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track the latest request so out-of-order responses can't clobber state.
  const reqIdRef = useRef(0);
  const abortRef = useRef(null);
  const rangeRef = useRef(null);

  const fetchRange = useCallback(
    async (range, { force = false } = {}) => {
      if (!range) return;
      rangeRef.current = range;
      const fromIso = new Date(range.start).toISOString();
      const toIso = new Date(range.end).toISOString();
      const key = cacheKey(status, fromIso, toIso);

      // Serve fresh cache instantly, skipping the network round-trip.
      const cached = rangeCache.get(key);
      if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
        setError(null);
        setOrders(cached.data);
        setLoading(false);
        onOrdersLoaded?.(cached.data);
        return;
      }

      const reqId = ++reqIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from: fromIso, to: toIso });
        if (status) params.set("status", status);
        const res = await fetch(`/api/v1/orders?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (reqId !== reqIdRef.current) return; // stale response
        if (!res.ok || !json?.success) throw new Error(json?.error || "load_failed");
        const rows = json.data ?? [];
        rangeCache.set(key, { ts: Date.now(), data: rows });
        if (rangeCache.size > CACHE_MAX) rangeCache.delete(rangeCache.keys().next().value);
        setOrders(rows);
        onOrdersLoaded?.(rows);
      } catch (err) {
        if (err?.name === "AbortError") return;
        if (reqId !== reqIdRef.current) return;
        setError(err?.message || "load_failed");
        setOrders([]);
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    },
    [status, onOrdersLoaded],
  );

  const handleRangeChange = useCallback((range) => { fetchRange(range); }, [fetchRange]);
  const handleRetry = useCallback(() => { fetchRange(rangeRef.current, { force: true }); }, [fetchRange]);

  // `status` is applied server-side, so a change must refetch the current range.
  // (datesSet doesn't fire on prop changes.) Skip the initial mount — the
  // calendar's first datesSet already performs the initial load.
  const didMountRef = useRef(false);
  const fetchRangeRef = useRef(fetchRange);
  useEffect(() => { fetchRangeRef.current = fetchRange; }, [fetchRange]);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    if (rangeRef.current) fetchRangeRef.current(rangeRef.current, { force: true });
  }, [status]);

  // Client-side filters that mirror the list view (status is applied server-side
  // via the `status` prop). Keeps filtering behaviour consistent across views.
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchSearch =
        !q ||
        String(o.order_number ?? "").includes(q) ||
        o.id?.toLowerCase().includes(q) ||
        o.shipping_address?.full_name?.toLowerCase().includes(q) ||
        o.shipping_address?.country?.toLowerCase().includes(q);
      const matchCancelledBy =
        cancelledBy === "any" ||
        (cancelledBy === "customer" && o.cancelled_by === "customer") ||
        (cancelledBy === "admin" && o.cancelled_by === "admin");
      return matchSearch && matchCancelledBy;
    });
  }, [orders, search, cancelledBy]);

  const isRevenue = mode === "revenue";

  // In revenue mode each day collapses into a single all-day total; otherwise
  // every order is its own event.
  const events = useMemo(() => {
    if (!isRevenue) return ordersToEvents(filteredOrders);
    const byDay = new Map(); // dayKey -> { revenue, count }
    for (const o of filteredOrders) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const cur = byDay.get(key) ?? { revenue: 0, count: 0 };
      cur.revenue += Number(o.total_amount ?? 0);
      cur.count += 1;
      byDay.set(key, cur);
    }
    return Array.from(byDay.entries()).map(([key, v]) => ({
      id: `rev-${key}`,
      start: key,
      allDay: true,
      classNames: ["oc-ev", "oc-ev-revenue"],
      extendedProps: { revenue: v.revenue, count: v.count },
    }));
  }, [filteredOrders, isRevenue]);

  // Per-day order totals keyed by local date (YYYY-MM-DD) for the month-view
  // count badges and busy-day "N orders" representation.
  const dayCounts = useMemo(() => {
    const map = new Map();
    for (const o of filteredOrders) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [filteredOrders]);

  const handleEventClick = useCallback(
    (arg) => {
      arg.jsEvent?.preventDefault?.();
      const id = arg.event?.extendedProps?.orderId ?? arg.event?.id;
      if (id) onOrderClick?.(id);
    },
    [onOrderClick],
  );

  // Revenue mode: clicking a day opens a sheet listing that day's orders.
  const [daySheet, setDaySheet] = useState({ open: false, date: null });
  const handleRevenueClick = useCallback((arg) => {
    arg.jsEvent?.preventDefault?.();
    setDaySheet({ open: true, date: arg.event.start });
  }, []);
  const closeDaySheet = useCallback(() => setDaySheet((s) => ({ ...s, open: false })), []);

  const daySheetOrders = useMemo(() => {
    if (!daySheet.date) return [];
    const key = dayKey(daySheet.date);
    return filteredOrders
      .filter((o) => dayKey(o.created_at) === key)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [daySheet.date, filteredOrders]);

  // Compact chip: order status + number, or the day's revenue total.
  const eventContent = useCallback(
    (arg) => {
      if (isRevenue) {
        const { revenue, count } = arg.event.extendedProps;
        const title = `${formatMadShort(revenue)}${count ? ` · ${count}` : ""}`;
        return (
          <div className="flex w-full items-center gap-1 overflow-hidden px-0.5" title={title}>
            <span className="truncate font-semibold">{formatMadShort(revenue)}</span>
          </div>
        );
      }
      const { status: st, orderNumber, total, customerName } = arg.event.extendedProps;
      const meta = statusMeta(st);
      const statusLabel = tTabs[st] ?? st;
      const title = [
        `#${orderNumber}`,
        customerName || null,
        statusLabel,
        formatMadShort(total),
      ]
        .filter(Boolean)
        .join(" · ");
      return (
        <div className="flex w-full items-center gap-1 overflow-hidden px-0.5" title={title}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-[2px] ${meta.dot}`} />
          <span className="truncate font-semibold">#{orderNumber}</span>
          <span className="ms-auto hidden shrink-0 opacity-70 sm:inline">{formatMadShort(total)}</span>
        </div>
      );
    },
    [tTabs, isRevenue],
  );

  // Month-view day cell: day number + a small "N" badge of that day's orders.
  const dayCellContent = useCallback(
    (arg) => {
      if (arg.view.type !== "dayGridMonth") return undefined;
      const key = `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, "0")}-${String(arg.date.getDate()).padStart(2, "0")}`;
      const count = dayCounts.get(key) ?? 0;
      return (
        <div className="oc-daynum">
          <span>{arg.dayNumberText}</span>
          {count > 0 && <span className="oc-day-count">{count}</span>}
        </div>
      );
    },
    [dayCounts],
  );

  return (
    <>
      <OrdersCalendar
        events={events}
        loading={loading}
        error={error}
        onRetry={handleRetry}
        onRangeChange={handleRangeChange}
        onEventClick={isRevenue ? handleRevenueClick : handleEventClick}
        eventContent={eventContent}
        dayCellContent={dayCellContent}
        allDaySlot={isRevenue}
        initialView={initialView}
        height={height}
        bare={bare}
      />
      {isRevenue && (
        <DayOrdersSheet
          open={daySheet.open}
          onClose={closeDaySheet}
          date={daySheet.date}
          orders={daySheetOrders}
          onOrderClick={onOrderClick}
        />
      )}
    </>
  );
}
