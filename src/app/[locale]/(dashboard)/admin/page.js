"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Settings, MoreVertical } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminDashboardSkeleton } from "@/components/skeletons";

const STATUS_STYLES = {
  active:   { pill: "bg-emerald-50 text-emerald-700" },
  draft:    { pill: "bg-zinc-100 text-zinc-600" },
  archived: { pill: "bg-amber-50 text-amber-700" },
};

export default function AdminDashboard() {
  const { locale } = useParams();
  const dict = useDictionary();
  const t = dict?.admin?.dashboard ?? {};
  const tStats = t.stats ?? {};
  const tH = t.headers ?? {};
  const tProductForm = dict?.admin?.products?.form ?? {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/admin/stats")
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!dict?.admin?.dashboard) return <AdminDashboardSkeleton />;

  const stats = data
    ? [
        { label: tStats.revenue,   value: `${Number(data.stats.revenue.value).toFixed(2)} DH`, trend: data.stats.revenue.trend },
        { label: tStats.orders,    value: data.stats.orders.value,   trend: data.stats.orders.trend },
        { label: tStats.products,  value: data.stats.products.value, trend: data.stats.products.trend },
        { label: tStats.customers, value: data.stats.customers.value, trend: data.stats.customers.trend },
      ]
    : [
        { label: tStats.revenue,   value: "—", trend: "" },
        { label: tStats.orders,    value: "—", trend: "" },
        { label: tStats.products,  value: "—", trend: "" },
        { label: tStats.customers, value: "—", trend: "" },
      ];

  const recentProducts = data?.recentProducts ?? [];

  return (
    <>
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">{t.title}</h1>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${locale}/admin/settings`}
            className="flex items-center gap-2 rounded-lg bg-white border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            <Settings className="h-4 w-4" />
            {t.customize}
          </Link>
          <Link
            href={`/${locale}/admin/products`}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t.add_product}
          </Link>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="rounded-xl border border-zinc-100 bg-white p-6">
            <p className="text-sm font-medium text-zinc-500 mb-1">{stat.label}</p>
            <h3 className={`text-2xl font-bold text-zinc-900 whitespace-nowrap ${loading ? "animate-pulse text-zinc-300" : ""}`}>
              {stat.value}
            </h3>
            {stat.trend && (
              <span className="text-sm font-medium text-zinc-400 mt-1 block">{stat.trend}</span>
            )}
          </div>
        ))}
      </div>

      {/* RECENT PRODUCTS TABLE */}
      <div className="rounded-xl border border-zinc-100 bg-white flex flex-col">
        <div className="border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">{t.recent_title}</h2>
          <Link
            href={`/${locale}/admin/products`}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {dict?.common?.view_all}
          </Link>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="divide-y divide-zinc-100 px-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="py-4 flex gap-4 animate-pulse">
                <div className="h-4 w-40 bg-zinc-100 rounded" />
                <div className="h-4 w-24 bg-zinc-100 rounded" />
                <div className="h-4 w-16 bg-zinc-100 rounded ml-auto" />
              </div>
            ))}
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && recentProducts.length === 0 && (
          <div className="px-6 py-10 text-center text-zinc-500 text-sm">
            {t.empty}
          </div>
        )}

        {/* MOBILE CARDS */}
        {!loading && recentProducts.length > 0 && (
          <ul className="divide-y divide-zinc-200 sm:hidden">
            {recentProducts.map((product) => (
              <li key={product.id} className="px-4 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900 text-sm truncate">{product.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {product.category ?? "—"} · {Number(product.price ?? 0).toFixed(2)} DH
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[product.status]?.pill ?? "bg-zinc-100 text-zinc-600"}`}>
                  {tProductForm[`status_${product.status}`] ?? product.status}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* DESKTOP TABLE */}
        {!loading && recentProducts.length > 0 && (
          <div className="hidden sm:block">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-white text-xs uppercase text-zinc-400 border-b border-zinc-100">
                <tr>
                  <th className="px-6 py-3 font-medium">{tH.product}</th>
                  <th className="px-6 py-3 font-medium">{tH.category}</th>
                  <th className="px-6 py-3 font-medium">{tH.price}</th>
                  <th className="px-6 py-3 font-medium">{tH.status}</th>
                  <th className="px-6 py-3 font-medium">{tH.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-zinc-50/50">
                    <td className="px-6 py-4 font-medium text-zinc-900">{product.name}</td>
                    <td className="px-6 py-4">{product.category ?? "—"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{Number(product.price ?? 0).toFixed(2)} DH</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[product.status]?.pill ?? "bg-zinc-100 text-zinc-600"}`}>
                        {tProductForm[`status_${product.status}`] ?? product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/${locale}/admin/products`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {dict?.common?.view}
                      </Link>
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
