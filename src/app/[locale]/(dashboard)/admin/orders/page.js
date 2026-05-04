"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, Filter, Download, ShoppingCart, RefreshCw, ChevronDown, Check } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminOrdersSkeleton } from "@/components/skeletons";

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

export default function AdminOrdersPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCoords, setFilterCoords] = useState({ top: 0, left: 0 });
  const [dateRange, setDateRange] = useState("all");
  const [cancelledBy, setCancelledBy] = useState("any");
  const filterBtnRef = useRef(null);
  const filterPanelRef = useRef(null);

  const dict = useDictionary();
  const t = dict?.admin?.orders ?? {};
  const tStats = t.stats ?? {};
  const tTabs = t.tabs ?? {};
  const tH = t.headers ?? {};

  /* ── Fetch orders + live MAD exchange rates in parallel ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, ratesRes] = await Promise.all([
        fetch("/api/v1/orders"),
        fetch("https://open.er-api.com/v6/latest/MAD"),
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

  if (!dict?.admin?.orders) return <AdminOrdersSkeleton />;

  return (
    <>
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
                <li key={o.id} className="px-4 py-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-900 text-sm">#{o.order_number ?? o.id.slice(0, 8)}</span>
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
                  <div className="flex items-center justify-between pt-1">
                    <div>
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
                    <tr key={o.id} className="hover:bg-zinc-50">
                      <td className="px-6 py-4 font-mono text-xs text-zinc-500">#{o.order_number ?? o.id.slice(0, 8)}</td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-zinc-900">{customer}</span>
                        {country && <span className="ml-1.5 text-xs text-zinc-400">{country}</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{date}</td>
                      <td className="px-6 py-4 font-semibold text-zinc-900 whitespace-nowrap">
                        {formatMAD(o.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                        {customerAmt ?? <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-6 py-4">
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
