"use client";

import { useState } from "react";
import { Search, Filter, Download, ShoppingCart } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";

const TAB_KEYS = ["all", "pending", "processing", "shipped", "delivered", "cancelled"];

const STATUS_STYLES = {
  Pending: "bg-amber-50 text-amber-700",
  Processing: "bg-blue-50 text-blue-700",
  Shipped: "bg-indigo-50 text-indigo-700",
  Delivered: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-red-50 text-red-700",
};

export default function AdminOrdersPage() {
  const [activeTab, setActiveTab] = useState("all");
  const orders = [];
  const dict = useDictionary();
  const t = dict?.admin?.orders ?? {};
  const tStats = t.stats ?? {};
  const tTabs = t.tabs ?? {};
  const tH = t.headers ?? {};

  const stats = [
    { label: tStats.total, value: "0" },
    { label: tStats.pending, value: "0" },
    { label: tStats.shipped, value: "0" },
    { label: tStats.revenue, value: "$0.00" },
  ];

  return (
    <>
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{t.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {t.subtitle}
          </p>
        </div>
        <button className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50">
          <Download className="h-4 w-4" />
          {t.export}
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-zinc-100 bg-white p-5"
          >
            <p className="text-sm font-medium text-zinc-500 mb-1">
              {stat.label}
            </p>
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
                  activeTab === tab
                    ? "bg-blue-50 text-blue-600"
                    : "text-zinc-600 hover:bg-zinc-50"
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
                placeholder={t.search}
                className="w-full sm:w-64 rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <button className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{dict?.common?.filter}</span>
            </button>
          </div>
        </div>

        {/* EMPTY STATE */}
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-3">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <p className="font-medium text-zinc-900 mb-1">{t.empty_title}</p>
            <p className="text-sm text-zinc-500">{t.empty_desc}</p>
          </div>
        )}

        {/* MOBILE CARDS */}
        {orders.length > 0 && (
          <ul className="divide-y divide-zinc-200 sm:hidden">
            {orders.map((o) => (
              <li key={o.id} className="px-4 py-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-900 text-sm">#{o.id}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[o.status] ?? "bg-zinc-100 text-zinc-700"}`}>
                    {o.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                  <div><span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">{tH.customer}</span>{o.customer}</div>
                  <div><span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">{tH.date}</span>{o.date}</div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold text-zinc-900">{o.total}</span>
                  <button className="text-sm font-medium text-blue-600 hover:underline">{dict?.common?.view}</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* DESKTOP TABLE */}
        {orders.length > 0 && (
          <div className="hidden sm:block">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-white text-xs uppercase text-zinc-400 border-b border-zinc-100">
                <tr>
                  <th className="px-6 py-3 font-medium">{tH.order}</th>
                  <th className="px-6 py-3 font-medium">{tH.customer}</th>
                  <th className="px-6 py-3 font-medium">{tH.date}</th>
                  <th className="px-6 py-3 font-medium">{tH.total}</th>
                  <th className="px-6 py-3 font-medium">{tH.status}</th>
                  <th className="px-6 py-3 font-medium text-right">{tH.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 font-medium text-zinc-900">#{o.id}</td>
                    <td className="px-6 py-4">{o.customer}</td>
                    <td className="px-6 py-4">{o.date}</td>
                    <td className="px-6 py-4">{o.total}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[o.status] ?? "bg-zinc-100 text-zinc-700"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-sm font-medium text-blue-600 hover:underline">{dict?.common?.view}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
