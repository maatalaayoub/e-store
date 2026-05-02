"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter, Download, ShoppingCart, RefreshCw } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminOrdersSkeleton } from "@/components/skeletons";

const TAB_KEYS = ["all", "pending", "processing", "shipped", "delivered", "cancelled"];

const STATUS_STYLES = {
  pending:    "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  shipped:    "bg-indigo-50 text-indigo-700",
  delivered:  "bg-emerald-50 text-emerald-700",
  cancelled:  "bg-red-50 text-red-700",
};

const STATUS_OPTIONS = ["pending", "processing", "shipped", "delivered", "cancelled"];

export default function AdminOrdersPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

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

  /* ── Filtered list ── */
  const filtered = orders.filter((o) => {
    const matchTab = activeTab === "all" || o.status === activeTab;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      o.id?.toLowerCase().includes(q) ||
      o.shipping_address?.full_name?.toLowerCase().includes(q) ||
      o.shipping_address?.country?.toLowerCase().includes(q);
    return matchTab && matchSearch;
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
            <button className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{dict?.common?.filter ?? "Filter"}</span>
            </button>
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
                    <span className="font-medium text-zinc-900 text-sm">#{o.id.slice(0, 8)}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[o.status] ?? "bg-zinc-100 text-zinc-700"}`}>
                      {o.status}
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
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-sm font-semibold text-zinc-900">{formatMAD(o.total_amount)}</span>
                      {customerAmt && <span className="ml-1.5 text-xs text-zinc-400">{customerAmt}</span>}
                    </div>
                    <select
                      value={o.status}
                      disabled={updatingId === o.id || o.cancelled_by === "customer"}
                      onChange={(e) => handleStatusChange(o.id, e.target.value)}
                      className="rounded border border-zinc-200 text-xs px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* DESKTOP TABLE */}
        {!loading && filtered.length > 0 && (
          <div className="hidden sm:block overflow-x-auto">
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
                      <td className="px-6 py-4 font-mono text-xs text-zinc-500">#{o.id.slice(0, 8)}</td>
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
                        <select
                          value={o.status}
                          disabled={updatingId === o.id || o.cancelled_by === "customer"}
                          onChange={(e) => handleStatusChange(o.id, e.target.value)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-70 disabled:cursor-not-allowed ${o.cancelled_by === "customer" ? "cursor-not-allowed" : "cursor-pointer"} ${STATUS_STYLES[o.status] ?? "bg-zinc-100 text-zinc-700"}`}
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
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
