"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Package,
  Pencil,
  Trash2,
} from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminProductsSkeleton } from "@/components/skeletons";

const TAB_KEYS = ["all", "active", "draft", "archived"];

export default function AdminProductsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const products = [];
  const dict = useDictionary();
  const t = dict?.admin?.products ?? {};
  const tTabs = t.tabs ?? {};
  const tH = t.headers ?? {};

  if (!dict?.admin?.products) return <AdminProductsSkeleton />;

  return (
    <>
      {/* HEADER */}
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{t.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {t.subtitle}
          </p>
        </div>
        <button className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          {t.add}
        </button>
      </div>

      {/* CARD */}
      <div className="rounded-xl border border-zinc-100 bg-white">
        {/* TABS + SEARCH */}
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

        {/* EMPTY STATE (shared) */}
        {products.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-3">
              <Package className="h-6 w-6" />
            </div>
            <p className="font-medium text-zinc-900 mb-1">{t.empty_title}</p>
            <p className="text-sm text-zinc-500 mb-4">{t.empty_desc}</p>
            <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              {t.add}
            </button>
          </div>
        )}

        {/* MOBILE CARDS */}
        {products.length > 0 && (
          <ul className="divide-y divide-zinc-200 sm:hidden">
            {products.map((p) => (
              <li key={p.id} className="px-4 py-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-900 text-sm">{p.name}</span>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                    {p.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500">
                  <div><span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">{tH.category}</span>{p.category}</div>
                  <div><span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">{tH.stock}</span>{p.inventory}</div>
                  <div><span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">{tH.price}</span>{p.price}</div>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <button className="p-1.5 text-zinc-400 hover:text-blue-600 rounded hover:bg-zinc-100" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  <button className="p-1.5 text-zinc-400 hover:text-red-600 rounded hover:bg-zinc-100" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                  <button className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded hover:bg-zinc-100" aria-label="More"><MoreVertical className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* DESKTOP TABLE */}
        {products.length > 0 && (
          <div className="hidden sm:block">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-white text-xs uppercase text-zinc-400 border-b border-zinc-100">
                <tr>
                  <th className="px-6 py-3 font-medium">{tH.product}</th>
                  <th className="px-6 py-3 font-medium">{tH.category}</th>
                  <th className="px-6 py-3 font-medium">{tH.inventory}</th>
                  <th className="px-6 py-3 font-medium">{tH.price}</th>
                  <th className="px-6 py-3 font-medium">{tH.status}</th>
                  <th className="px-6 py-3 font-medium text-right">{tH.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 font-medium text-zinc-900">{p.name}</td>
                    <td className="px-6 py-4">{p.category}</td>
                    <td className="px-6 py-4">{p.inventory}</td>
                    <td className="px-6 py-4">{p.price}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{p.status}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 text-zinc-400 hover:text-blue-600 rounded hover:bg-zinc-100" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                        <button className="p-1.5 text-zinc-400 hover:text-red-600 rounded hover:bg-zinc-100" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                        <button className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded hover:bg-zinc-100" aria-label="More"><MoreVertical className="h-4 w-4" /></button>
                      </div>
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
