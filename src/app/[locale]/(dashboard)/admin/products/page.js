"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Search,
  Filter,
  Package,
  Pencil,
  Trash2,
  Archive,
  FileText,
  Star,
  Loader2,
  Check,
  AlertTriangle,
  MoreVertical,
} from "lucide-react";

import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminProductsSkeleton } from "@/components/skeletons";
import ProductFormModal from "./_components/ProductFormModal";

// ── Custom confirm modal ────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, orders, confirmLabel = "Confirm", confirmVariant = "red", cancelLabel = "Cancel", onConfirm, onCancel }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-zinc-900 text-sm">{title}</p>
            {message && <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{message}</p>}
            {orders && orders.length > 0 && (
              <ul className="mt-3 rounded-lg bg-zinc-50 border border-zinc-200 divide-y divide-zinc-100 text-xs max-h-36 overflow-y-auto">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-3 py-2 gap-2">
                    <span className="font-mono font-medium text-zinc-700">#{o.order_number}</span>
                    <span className="capitalize text-amber-600 font-medium">{o.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              confirmVariant === "amber"
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Per-row action dropdown ────────────────────────────────────────────────
function ActionMenu({ product, onEdit, onDelete, onSetStatus, disabled }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const PANEL_W = 176;
      // count visible menu items dynamically
      const statusItems = ["active", "archived", "draft"].filter((s) => s !== product.status).length;
      const PANEL_H = 44 + statusItems * 40 + 1 + 40; // edit + status items + divider + delete
      const isRtl = document.documentElement.dir === "rtl";
      const left = isRtl ? rect.left : Math.max(8, rect.right - PANEL_W);
      const top = rect.bottom + 4 + PANEL_H > window.innerHeight
        ? rect.top - PANEL_H - 4
        : rect.bottom + 4;
      setCoords({ top, left });
    }
    setOpen(true);
  };

  const pick = (fn) => { setOpen(false); fn(); };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        disabled={disabled}
        className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded hover:bg-zinc-100 disabled:opacity-40"
        aria-label="Actions"
      >
        {disabled
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <MoreVertical className="h-4 w-4" />}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, width: 176, zIndex: 10000 }}
          className="rounded-xl border border-zinc-200 bg-white shadow-xl py-1 flex flex-col"
        >
          <button
            onClick={() => pick(onEdit)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <Pencil className="h-4 w-4 text-zinc-400" />
            Edit
          </button>
          {product.status !== "active" && (
            <button
              onClick={() => pick(() => onSetStatus("active"))}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <Check className="h-4 w-4 text-emerald-500" />
              Set as Active
            </button>
          )}
          {product.status !== "archived" && (
            <button
              onClick={() => pick(() => onSetStatus("archived"))}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <Archive className="h-4 w-4 text-zinc-400" />
              Archive
            </button>
          )}
          {product.status !== "draft" && (
            <button
              onClick={() => pick(() => onSetStatus("draft"))}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <FileText className="h-4 w-4 text-zinc-400" />
              Set as Draft
            </button>
          )}
          <div className="border-t border-zinc-100 my-1" />
          <button
            onClick={() => pick(onDelete)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

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
  const [actioningId, setActioningId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCoords, setFilterCoords] = useState({ top: 0, left: 0 });
  const [filterCategory, setFilterCategory] = useState("");
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [filterDiscount, setFilterDiscount] = useState(false);
  const filterBtnRef = useRef(null);
  const filterPanelRef = useRef(null);

  const dict = useDictionary();
  const t = dict?.admin?.products ?? {};
  const tTabs = t.tabs ?? {};
  const tH = t.headers ?? {};
  const tFp = t.filter_panel ?? {};

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
    setConfirmModal({
      title: `Delete "${product.name}"?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      confirmVariant: "red",
      onConfirm: async () => {
        setConfirmModal(null);
        setActioningId(product.id);
        try {
          const res = await fetch(`/api/v1/products/${product.id}`, { method: "DELETE" });
          if (res.ok) {
            toast.success(`"${product.name}" deleted.`);
            fetchProducts();
          } else if (res.status === 409) {
            const json = await res.json();
            // Active orders block deletion — offer archive
            setConfirmModal({
              title: `Cannot delete "${product.name}"`,
              message: "This product is linked to active orders. Archive it instead to hide it from the shop.",
              orders: json.orders ?? [],
              confirmLabel: "Archive instead",
              confirmVariant: "amber",
              onConfirm: async () => {
                setConfirmModal(null);
                const archiveRes = await fetch(`/api/v1/products/${product.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "archived" }),
                });
                if (archiveRes.ok) {
                  toast.success(`"${product.name}" archived.`);
                  fetchProducts();
                } else {
                  toast.error("Failed to archive product.");
                }
                setActioningId(null);
              },
            });
            return;
          } else {
            toast.error("Failed to delete product.");
          }
        } catch {
          toast.error("Something went wrong. Please try again.");
        }
        setActioningId(null);
      },
    });
  }

  async function handleSetStatus(product, status) {
    // "Set as active" is safe — apply immediately without a confirm dialog
    if (status === "active") {
      setActioningId(product.id);
      try {
        const res = await fetch(`/api/v1/products/${product.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        });
        if (res.ok) {
          toast.success(`"${product.name}" is now active.`);
          fetchProducts();
        } else {
          toast.error("Failed to update product.");
        }
      } catch {
        toast.error("Something went wrong.");
      }
      setActioningId(null);
      return;
    }

    const label = status === "archived" ? "Archive" : "Set as Draft";
    setConfirmModal({
      title: `${label} "${product.name}"?`,
      message: status === "archived"
        ? "Archived products are hidden from the shop."
        : "Draft products are not visible in the shop.",
      confirmLabel: label,
      confirmVariant: "amber",
      onConfirm: async () => {
        setConfirmModal(null);
        setActioningId(product.id);
        try {
          const res = await fetch(`/api/v1/products/${product.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });
          if (res.ok) {
            toast.success(`"${product.name}" set to ${status}.`);
            fetchProducts();
          } else {
            toast.error("Failed to update product.");
          }
        } catch {
          toast.error("Something went wrong.");
        }
        setActioningId(null);
      },
    });
  }

  function handleSaved() {
    fetchProducts();
  }

  function handleCategoryCreated(cat) {
    setCategories((prev) => [...prev, cat]);
  }

  // ── Filter panel ───────────────────────────────────────────────────────────
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
      const PANEL_H = 270;
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

  const clearFilters = () => { setFilterCategory(""); setFilterFeatured(false); setFilterDiscount(false); };
  const activeFilterCount = (filterCategory ? 1 : 0) + (filterFeatured ? 1 : 0) + (filterDiscount ? 1 : 0);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = (products ?? []).filter((p) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.category?.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterFeatured && !p.is_featured) return false;
    if (filterDiscount && !(p.effective_price != null && p.effective_price < p.price)) return false;
    return true;
  });

  const uniqueCategories = [...new Set((products ?? []).map((p) => p.category).filter(Boolean))];

  if (!dict?.admin?.products) return <AdminProductsSkeleton />;

  return (
    <>
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title}
        message={confirmModal?.message}
        orders={confirmModal?.orders}
        confirmLabel={confirmModal?.confirmLabel}
        confirmVariant={confirmModal?.confirmVariant}
        onConfirm={confirmModal?.onConfirm}
        onCancel={() => { setConfirmModal(null); setActioningId(null); }}
      />
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
                {/* Category */}
                {uniqueCategories.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{tFp.category ?? "Category"}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFilterCategory("")}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          !filterCategory ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        {tFp.all ?? "All"}
                      </button>
                      {uniqueCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFilterCategory(cat === filterCategory ? "" : cat)}
                          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                            filterCategory === cat ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Toggles */}
                <div className="flex flex-col gap-2">
                  {[
                    { key: "featured", label: tFp.featured_only ?? "Featured only", value: filterFeatured, set: setFilterFeatured },
                    { key: "discount", label: tFp.has_discount  ?? "Has discount",  value: filterDiscount, set: setFilterDiscount },
                  ].map(({ key, label, value, set }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => set((v) => !v)}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        value ? "border-blue-300 bg-blue-50 text-blue-700" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        value ? "bg-blue-600 border-blue-600" : "border-zinc-300"
                      }`}>
                        {value && <Check className="h-3 w-3 text-white" />}
                      </span>
                      {label}
                    </button>
                  ))}
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
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[p.status] ?? "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {p.status}
                      </span>
                      <ActionMenu
                        product={p}
                        disabled={actioningId === p.id}
                        onEdit={() => openEdit(p)}
                        onDelete={() => handleDelete(p)}
                        onSetStatus={(status) => handleSetStatus(p, status)}
                      />
                    </div>
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
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* DESKTOP TABLE */}
        {filtered.length > 0 && (
          <div className="hidden sm:block overflow-x-auto scrollbar-hide">
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
                      <div className="flex items-center justify-end">
                        <ActionMenu
                          product={p}
                          disabled={actioningId === p.id}
                          onEdit={() => openEdit(p)}
                          onDelete={() => handleDelete(p)}
                          onSetStatus={(status) => handleSetStatus(p, status)}
                        />
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



