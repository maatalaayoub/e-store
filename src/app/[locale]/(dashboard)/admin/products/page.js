"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Package,
  Pencil,
  Trash2,
  Star,
  Loader2,
} from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminProductsSkeleton } from "@/components/skeletons";
import ProductFormModal from "./_components/ProductFormModal";

const TAB_KEYS = ["all", "active", "draft", "archived"];

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-zinc-100 text-zinc-500",
  archived: "bg-amber-50 text-amber-700",
};

function formatPrice(price, effectivePrice) {
  if (price == null) return "—";
  const fmt = (n) => `${Number(n).toFixed(2)} DH`;
  if (effectivePrice != null && effectivePrice < price) {
    return (
      <span className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5">
        <span className="text-zinc-900 font-medium">{fmt(effectivePrice)}</span>
        <span className="text-zinc-400 line-through text-xs">{fmt(price)}</span>
      </span>
    );
  }
  return fmt(price);
}

export default function AdminProductsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState(null); // null = loading
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const dict = useDictionary();
  const t = dict?.admin?.products ?? {};
  const tTabs = t.tabs ?? {};
  const tH = t.headers ?? {};

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setProducts(null);
    try {
      const status = activeTab === "all" ? "all" : activeTab;
      const res = await fetch(`/api/v1/products?status=${status}`);
      const json = await res.json();
      setProducts(Array.isArray(json.data) ? json.data : []);
    } catch {
      setProducts([]);
    }
  }, [activeTab]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/categories");
      const json = await res.json();
      if (json.success) setCategories(json.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ── Actions ────────────────────────────────────────────────────────────────
  function openCreate() {
    setEditingProduct(null);
    setModalOpen(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setModalOpen(true);
  }

  async function handleDelete(product) {
    const confirmed = window.confirm(
      `Delete "${product.name}"? This cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingId(product.id);
    try {
      await fetch(`/api/v1/products/${product.id}`, { method: "DELETE" });
      fetchProducts();
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved() {
    fetchProducts();
  }

  function handleCategoryCreated(cat) {
    setCategories((prev) => [...prev, cat]);
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = (products ?? []).filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  });

  if (!dict?.admin?.products) return <AdminProductsSkeleton />;

  return (
    <>
      <ProductFormModal
        open={modalOpen}
        product={editingProduct}
        categories={categories}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        onCategoryCreated={handleCategoryCreated}
      />

      {/* HEADER */}
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{t.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">{t.subtitle}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

        {/* LOADING */}
        {products === null && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        )}

        {/* EMPTY STATE */}
        {products !== null && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-3">
              <Package className="h-6 w-6" />
            </div>
            <p className="font-medium text-zinc-900 mb-1">{t.empty_title}</p>
            <p className="text-sm text-zinc-500 mb-4">{t.empty_desc}</p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              {t.add}
            </button>
          </div>
        )}

        {/* MOBILE CARDS */}
        {filtered.length > 0 && (
          <ul className="divide-y divide-zinc-100 sm:hidden">
            {filtered.map((p) => (
              <li key={p.id} className="px-4 py-4 flex items-start gap-3">
                {/* Thumbnail */}
                <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-zinc-100">
                  {p.main_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.main_image}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-zinc-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-900 text-sm truncate">
                      {p.name}
                      {p.is_featured && (
                        <Star className="inline h-3 w-3 text-yellow-400 fill-yellow-400 ms-1" />
                      )}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[p.status] ?? "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500 mt-1.5">
                    <div>
                      <span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">
                        {tH.category}
                      </span>
                      {p.category ?? "—"}
                    </div>
                    <div>
                      <span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">
                        {tH.stock}
                      </span>
                      {p.stock}
                    </div>
                    <div>
                      <span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">
                        {tH.price}
                      </span>
                      {formatPrice(p.price, p.effective_price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 pt-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 text-zinc-400 hover:text-blue-600 rounded hover:bg-zinc-100"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={deletingId === p.id}
                      className="p-1.5 text-zinc-400 hover:text-red-600 rounded hover:bg-zinc-100 disabled:opacity-50"
                      aria-label="Delete"
                    >
                      {deletingId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* DESKTOP TABLE */}
        {filtered.length > 0 && (
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-white text-xs uppercase text-zinc-400 border-b border-zinc-100">
                <tr>
                  <th className="px-6 py-3 font-medium">{tH.product}</th>
                  <th className="px-6 py-3 font-medium">{tH.category}</th>
                  <th className="px-6 py-3 font-medium">{tH.inventory}</th>
                  <th className="px-6 py-3 font-medium">{tH.price}</th>
                  <th className="px-6 py-3 font-medium">{tH.status}</th>
                  <th className="px-6 py-3 font-medium text-right">
                    {tH.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-zinc-100">
                          {p.main_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.main_image}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Package className="h-4 w-4 text-zinc-300" />
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-zinc-900 max-w-[200px] truncate">
                          {p.name}
                          {p.is_featured && (
                            <Star className="inline h-3 w-3 text-yellow-400 fill-yellow-400 ms-1 mb-0.5" />
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{p.category ?? "—"}</td>
                    <td className="px-6 py-4">{p.stock}</td>
                    <td className="px-6 py-4">
                      {formatPrice(p.price, p.effective_price)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          STATUS_STYLES[p.status] ?? "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-zinc-400 hover:text-blue-600 rounded hover:bg-zinc-100"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={deletingId === p.id}
                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded hover:bg-zinc-100 disabled:opacity-50"
                          aria-label="Delete"
                        >
                          {deletingId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                        <button className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded hover:bg-zinc-100">
                          <MoreVertical className="h-4 w-4" />
                        </button>
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



