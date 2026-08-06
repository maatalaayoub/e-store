"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter, useParams } from "next/navigation";
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
  Tag,
  ArrowUpRight,
} from "lucide-react";

import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useAdminOrderView } from "@/components/providers/AdminOrderViewContext";
import { AdminProductsSkeleton } from "@/components/skeletons";
import ProductFormModal from "./_components/ProductFormModal";
import CategoriesManagerModal from "./_components/CategoriesManagerModal";
import ProductDetailDrawer from "./_components/ProductDetailDrawer";

// ── Custom confirm modal ────────────────────────────────────────────────────
function ConfirmModal({
  open,
  title,
  message,
  orders,
  onOrderClick,
  confirmLabel = "Confirm",
  confirmVariant = "red",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  if (!open || typeof document === "undefined") return null;
  const hasOrders = Array.isArray(orders) && orders.length > 0;
  const isBlocking = hasOrders; // "Cannot delete" variant

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(2px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              isBlocking ? "bg-amber-50 ring-4 ring-amber-50/50" : "bg-red-50 ring-4 ring-red-50/50"
            }`}
          >
            <AlertTriangle
              className={`h-5 w-5 ${isBlocking ? "text-amber-600" : "text-red-500"}`}
            />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="font-semibold text-zinc-900 text-base leading-tight">{title}</p>
            {message && (
              <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">{message}</p>
            )}
          </div>
        </div>

        {/* Clickable orders list */}
        {hasOrders && (
          <div className="px-6 pb-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center justify-between">
              <span>Linked orders ({orders.length})</span>
              <span className="text-zinc-300 font-normal normal-case tracking-normal">Click to open</span>
            </div>
            <ul className="rounded-xl border border-zinc-200 bg-zinc-50/60 divide-y divide-zinc-200 max-h-56 overflow-y-auto">
              {orders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onOrderClick?.(o)}
                    className="group flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-sm hover:bg-white transition-colors focus-visible:bg-white focus-visible:outline-none"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <ArrowUpRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-blue-600 transition-colors shrink-0" />
                      <span className="font-mono font-medium text-zinc-800 truncate">
                        #{o.order_number ?? String(o.id).slice(0, 8)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                        o.status === "pending"
                          ? "bg-amber-50 text-amber-700"
                          : o.status === "confirmed"
                            ? "bg-blue-50 text-blue-700"
                            : o.status === "shipped"
                              ? "bg-violet-50 text-violet-700"
                              : o.status === "delivered"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {o.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 bg-zinc-50 border-t border-zinc-100">
          <button
            onClick={onCancel}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors ${
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

// Highlight products that are running out. Tune LOW_STOCK_THRESHOLD as needed.
const LOW_STOCK_THRESHOLD = 5;

function getStockLevel(stock) {
  const n = Number(stock);
  if (!Number.isFinite(n) || n <= 0) return "out";
  if (n <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

const STOCK_ROW_STYLES = {
  out: "bg-red-50 hover:bg-red-100",
  low: "bg-amber-50 hover:bg-amber-100",
  ok: "hover:bg-zinc-50",
};

const STOCK_TEXT_STYLES = {
  out: "text-red-700 font-semibold",
  low: "text-amber-700 font-semibold",
  ok: "text-zinc-600",
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
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loadingEditProductId, setLoadingEditProductId] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCoords, setFilterCoords] = useState({ top: 0, left: 0 });
  const [filterCategory, setFilterCategory] = useState("");
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [filterDiscount, setFilterDiscount] = useState(false);
  const filterBtnRef = useRef(null);
  const filterPanelRef = useRef(null);

  // ── Deep-link from notifications: scroll to & highlight a specific product ─
  const searchParams = useSearchParams();
  const highlightProductId = searchParams.get("product");
  const [pulseProductId, setPulseProductId] = useState(null);

  // ── Navigate to orders page & auto-open a specific order ──────────────────
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale ?? "en";
  const { openOrder } = useAdminOrderView();

  const handleOpenLinkedOrder = useCallback(
    (order) => {
      if (!order?.id) return;
      openOrder(order.id);
      setConfirmModal(null);
      setActioningId(null);
      router.push(`/${locale}/admin/orders`);
    },
    [openOrder, router, locale]
  );

  // ── Detail drawer state ────────────────────────────────────────────────────
  const [viewingProduct, setViewingProduct] = useState(null);

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

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // When arriving with ?product=<id> from a notification, scroll the matching
  // row into view and briefly highlight it once the list has finished loading.
  useEffect(() => {
    if (!highlightProductId) return;
    if (!products || products.length === 0) return;
    const target = products.find(
      (p) => String(p.id) === String(highlightProductId)
    );
    if (!target) return;
    // Defer to next frame so the rows are actually mounted after this render.
    const raf = requestAnimationFrame(() => {
      const selector = `[data-product-id="${CSS.escape(String(target.id))}"]`;
      // Both the mobile <ul> and the desktop <table> render simultaneously
      // (one is display:none via Tailwind's sm:hidden / hidden sm:block).
      // Pick the row that is actually visible so scrollIntoView has an effect.
      const candidates = Array.from(document.querySelectorAll(selector));
      const el =
        candidates.find((node) => node.offsetParent !== null) ??
        candidates[0] ??
        null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setPulseProductId(String(target.id));
    });
    const timer = setTimeout(() => setPulseProductId(null), 2600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [highlightProductId, products]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const res = await fetch("/api/v1/categories");
        const json = await res.json();
        if (!cancelled && json.success) {
          setCategories(json.data);
        }
      } catch {
        // ignore
      }
    }

    loadCategories();
    return () => { cancelled = true; };
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  function openCreate() {
    setEditingProduct(null);
    setModalOpen(true);
  }

  async function openEdit(product) {
    setLoadingEditProductId(product.id);
    try {
      const res = await fetch(`/api/v1/products/${product.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setEditingProduct(json.data);
        setModalOpen(true);
      } else {
        toast.error("Failed to load product details.");
      }
    } catch {
      toast.error("Failed to load product details.");
    } finally {
      setLoadingEditProductId(null);
    }
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

  /**
   * Called by CategoriesManagerModal whenever a category is created / renamed /
   * deleted. We update the local list optimistically so filters and the product
   * form dropdown stay in sync, and refetch products when a rename or delete
   * could have changed the visible category names.
   */
  function handleCategoriesChanged({ type, category }) {
    if (!category) return;
    setCategories((prev) => {
      if (type === "deleted") return prev.filter((c) => c.id !== category.id);
      if (type === "updated") {
        return prev
          .map((c) => (c.id === category.id ? { ...c, ...category } : c))
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      if (type === "created") {
        if (prev.some((c) => c.id === category.id)) return prev;
        return [...prev, category].sort((a, b) => a.name.localeCompare(b.name));
      }
      return prev;
    });
    // Products carry category *names* in their normalized shape — rename/delete
    // requires a refetch so the products table reflects the new labels.
    if (type === "updated" || type === "deleted") {
      if (filterCategory && category.name && filterCategory === category.name) {
        setFilterCategory(type === "deleted" ? "" : category.name);
      }
      fetchProducts();
    }
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
        onOrderClick={handleOpenLinkedOrder}
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
      <CategoriesManagerModal
        open={categoriesModalOpen}
        onClose={() => setCategoriesModalOpen(false)}
        onChanged={handleCategoriesChanged}
      />
      <ProductDetailDrawer
        product={viewingProduct}
        onClose={() => setViewingProduct(null)}
        onEdit={(p) => {
          setViewingProduct(null);
          openEdit(p);
        }}
      />

      {/* HEADER */}
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{t.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCategoriesModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Tag className="h-4 w-4" />
            {t.manage_categories ?? "Manage Categories"}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t.add}
          </button>
        </div>
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
            {filtered.map((p) => {
              const stockLevel = getStockLevel(p.stock);
              const isPulsing = pulseProductId === String(p.id);
              return (
              <li
                key={p.id}
                data-product-id={p.id}
                onClick={() => setViewingProduct(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setViewingProduct(p);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`px-4 py-4 flex items-start gap-3 transition-colors cursor-pointer ${STOCK_ROW_STYLES[stockLevel]} ${
                  isPulsing ? "ring-2 ring-blue-500 ring-inset animate-pulse" : ""
                }`}
              >
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
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[p.status] ?? "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {p.status}
                      </span>
                      <ActionMenu
                        product={p}
                        disabled={actioningId === p.id || loadingEditProductId === p.id}
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
                      <span className={STOCK_TEXT_STYLES[stockLevel]}>{p.stock}</span>
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
              );
            })}
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
                {filtered.map((p) => {
                  const stockLevel = getStockLevel(p.stock);
                  const isPulsing = pulseProductId === String(p.id);
                  return (
                  <tr
                    key={p.id}
                    data-product-id={p.id}
                    onClick={() => setViewingProduct(p)}
                    className={`transition-colors cursor-pointer ${STOCK_ROW_STYLES[stockLevel]} ${
                      isPulsing ? "ring-2 ring-blue-500 ring-inset animate-pulse" : ""
                    }`}
                  >
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
                    <td className={`px-6 py-4 ${STOCK_TEXT_STYLES[stockLevel]}`}>
                      {p.stock}
                    </td>
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
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <ActionMenu
                          product={p}
                          disabled={actioningId === p.id || loadingEditProductId === p.id}
                          onEdit={() => openEdit(p)}
                          onDelete={() => handleDelete(p)}
                          onSetStatus={(status) => handleSetStatus(p, status)}
                        />
                      </div>
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



