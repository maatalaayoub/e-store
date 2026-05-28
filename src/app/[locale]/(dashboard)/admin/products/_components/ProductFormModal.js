"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import ImageManager from "./ImageManager";
import SectionsBuilder from "@/components/admin/product-sections/SectionsBuilder";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { RTL_LOCALES } from "@/config/constants";

// ── helpers ─────────────────────────────────────────────────────────────────────
const SUPPORTED_LANGS = ["en", "fr", "ar", "dr"];
const LANG_LABELS = { en: "English", fr: "Français", ar: "العربية", dr: "الدارجة" };
const RTL_LANGS = new Set(RTL_LOCALES);

function emptyTranslations() {
  return Object.fromEntries(
    SUPPORTED_LANGS.map((l) => [l, { name: "", short_description: "", description: "" }])
  );
}

const initialForm = {
  translations: emptyTranslations(),
  category_id: "",
  price: "",
  discountType: "none", // "none" | "price" | "percentage"
  discount_price: "",
  discount_percentage: "",
  stock: "",
  status: "draft",
  is_featured: false,
  colors: [], // [{ name, hex }]
  sizes: [],  // ["S", "M", ...]
  use_default_sections: true,
  sections_config: [],
};

function formReducer(state, action) {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "set_translation":
      return {
        ...state,
        translations: {
          ...state.translations,
          [action.lang]: {
            ...state.translations[action.lang],
            [action.field]: action.value,
          },
        },
      };
    case "reset":
      return { ...initialForm, ...action.payload };
    default:
      return state;
  }
}

function productToForm(p) {
  let discountType = "none";
  if (p.discount_price != null) discountType = "price";
  else if (p.discount_percentage != null) discountType = "percentage";

  const translations = emptyTranslations();
  if (p.translations && typeof p.translations === "object") {
    SUPPORTED_LANGS.forEach((l) => {
      if (p.translations[l]) {
        translations[l] = {
          name: p.translations[l].name ?? "",
          short_description: p.translations[l].short_description ?? "",
          description: p.translations[l].description ?? "",
        };
      }
    });
  } else {
    // Legacy product without translations: pre-fill all langs with existing text fields
    SUPPORTED_LANGS.forEach((l) => {
      translations[l] = {
        name: p.name ?? "",
        short_description: p.short_description ?? "",
        description: p.description ?? "",
      };
    });
  }

  return {
    translations,
    category_id: p.category_id ?? "",
    price: p.price != null ? String(p.price) : "",
    discountType,
    discount_price: p.discount_price != null ? String(p.discount_price) : "",
    discount_percentage:
      p.discount_percentage != null ? String(p.discount_percentage) : "",
    stock: p.stock != null ? String(p.stock) : "",
    status: p.status ?? "draft",
    is_featured: p.is_featured ?? false,
    colors: Array.isArray(p.colors) ? p.colors : [],
    sizes: Array.isArray(p.sizes) ? p.sizes : [],
    use_default_sections: p.use_default_sections !== false,
    sections_config: Array.isArray(p.sections_config) ? p.sections_config : [],
  };
}

async function uploadToStorage(supabase, productId, file, index) {
  const ext = file.name.split(".").pop();
  const path = `products/${productId}/${Date.now()}_${index}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

// ── component ─────────────────────────────────────────────────────────────────
export default function ProductFormModal({
  open,
  product = null, // null = create, object = edit
  categories = [],
  onClose,
  onSaved,
  onCategoryCreated,
}) {
  const [animOpen, setAnimOpen] = useState(false);   // drives CSS transition
  const [mounted, setMounted] = useState(false);     // keeps DOM alive during exit
  const [form, dispatch] = useReducer(formReducer, initialForm);
  const [pendingImages, setPendingImages] = useState([]); // { file, preview, isMain }
  const [existingImages, setExistingImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [catCoords, setCatCoords] = useState({ top: 0, left: 0, width: 0 });
  const catBtnRef = useRef(null);
  const catPanelRef = useRef(null);
  const panelRef = useRef(null);

  const params = useParams();
  const locale = params?.locale || "en";
  const [activeLang, setActiveLang] = useState(locale);
  const dict = useDictionary();
  const t = dict?.admin?.products?.form ?? {};

  const STATUS_STYLES = {
    active:   { pill: "border-emerald-300 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
    draft:    { pill: "border-zinc-300 bg-zinc-100 text-zinc-600",         dot: "bg-zinc-400"   },
    archived: { pill: "border-amber-300 bg-amber-50 text-amber-700",       dot: "bg-amber-400"  },
  };
  const STATUS_OPTIONS = ["active", "draft", "archived"];

  const isEdit = Boolean(product?.id);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  /**
   * Auto-save sections_config to the server when editing an existing product.
   * Only called by SectionsBuilder's onSave / onDelete — skipped for new products.
   */
  async function handleSaveSections(next) {
    if (!isEdit || !product?.id) return; // new product — save happens on form submit
    const res = await fetch(`/api/v1/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections_config: next, use_default_sections: false }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to save sections");
    toast.success(t.sections_saved ?? "Sections saved");
  }

  /** Toggle "Use default layout" — seeds sections_config from global defaults when switching to custom. */
  async function handleToggleDefaultSections(checked) {
    if (!checked && form.sections_config.length === 0) {
      // Unchecking with no custom sections yet → fetch global defaults as a starting point,
      // but mark every section as disabled so the user opts-in to each one.
      setLoadingDefaults(true);
      try {
        const res = await fetch("/api/v1/admin/product-sections");
        const json = await res.json();
        const defaults = Array.isArray(json?.data) && json.data.length > 0 ? json.data : null;
        if (defaults) {
          const allDisabled = defaults.map((s) => ({ ...s, enabled: false }));
          dispatch({ type: "set", field: "sections_config", value: allDisabled });
        }
      } catch {
        // silently ignore — user can still use the empty builder
      } finally {
        setLoadingDefaults(false);
      }
    }
    dispatch({ type: "set", field: "use_default_sections", value: checked });
  }

  // Sync form when product changes + drive animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      setActiveLang(locale);
      dispatch({ type: "reset", payload: product ? productToForm(product) : {} });
      setExistingImages(
        product?.images
          ? [...product.images].sort((a, b) => {
              if (a.is_main !== b.is_main) return a.is_main ? -1 : 1;
              return (a.display_order ?? 0) - (b.display_order ?? 0);
            })
          : []
      );
      setPendingImages([]);
      setError(null);
      setShowNewCat(false);
      setNewCategoryName("");
      // Trigger open transition after mount
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimOpen(true)));
    } else {
      setAnimOpen(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open, product]);

  const handleClose = useCallback(() => {
    setAnimOpen(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  // Revoke object URLs on unmount / image removal
  useEffect(() => {
    return () => {
      pendingImages.forEach((img) => URL.revokeObjectURL(img.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── image handlers ──────────────────────────────────────────────────────────
  function handleAddPending(files) {
    const newItems = Array.from(files).map((file, i) => ({
      file,
      preview: URL.createObjectURL(file),
      isMain: pendingImages.length === 0 && existingImages.length === 0 && i === 0,
    }));
    setPendingImages((prev) => [...prev, ...newItems]);
  }

  function handleRemovePending(idx) {
    setPendingImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      const next = prev.filter((_, i) => i !== idx);
      // Promote first pending to main if the removed one was main and no existing main
      if (prev[idx].isMain && !existingImages.some((img) => img.is_main) && next.length > 0) {
        next[0] = { ...next[0], isMain: true };
      }
      return next;
    });
  }

  function handleSetPendingMain(idx) {
    // Unset all existing mains
    setExistingImages((prev) => prev.map((img) => ({ ...img, is_main: false })));
    setPendingImages((prev) =>
      prev.map((img, i) => ({ ...img, isMain: i === idx }))
    );
  }

  function handleRemoveExisting(imageId) {
    setExistingImages((prev) => {
      const removed = prev.find((img) => img.id === imageId);
      const next = prev.filter((img) => img.id !== imageId);
      // Promote first remaining to main if removed was main
      if (removed?.is_main && next.length > 0) {
        next[0] = { ...next[0], is_main: true };
      }
      return next;
    });
  }

  function handleSetExistingMain(imageId) {
    setExistingImages((prev) =>
      prev.map((img) => ({ ...img, is_main: img.id === imageId }))
    );
    setPendingImages((prev) => prev.map((img) => ({ ...img, isMain: false })));
  }

  // ── category dropdown open/close ───────────────────────────────────────────
  useEffect(() => {
    if (!catOpen) return;
    const handler = (e) => {
      if (
        catBtnRef.current && !catBtnRef.current.contains(e.target) &&
        catPanelRef.current && !catPanelRef.current.contains(e.target)
      ) setCatOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [catOpen]);

  function openCatDropdown() {
    const rect = catBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setCatCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setCatOpen((v) => !v);
  }

  // ── category creation ───────────────────────────────────────────────────────
  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const res = await fetch("/api/v1/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create category");
      onCategoryCreated?.(json.data);
      dispatch({ type: "set", field: "category_id", value: json.data.id });
      setNewCategoryName("");
      setShowNewCat(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingCategory(false);
    }
  }

  // ── save ────────────────────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Derive primary name/description from translations
      const primaryTrans = form.translations[locale] ?? {};
      const fallbackTrans = SUPPORTED_LANGS.map((l) => form.translations[l]).find((tr) => tr?.name?.trim());
      const primaryName = primaryTrans.name?.trim() || fallbackTrans?.name?.trim() || "";
      if (!primaryName) {
        setError("Product name is required in at least one language.");
        setSaving(false);
        return;
      }

      // Build translations object — only include langs that have content
      const translationsData = {};
      SUPPORTED_LANGS.forEach((l) => {
        const tr = form.translations[l];
        if (tr?.name?.trim() || tr?.short_description?.trim() || tr?.description?.trim()) {
          translationsData[l] = {
            name: tr.name.trim() || null,
            short_description: tr.short_description.trim() || null,
            description: tr.description.trim() || null,
          };
        }
      });

      const payload = {
        name: primaryName,
        short_description:
          primaryTrans.short_description?.trim() || fallbackTrans?.short_description?.trim() || null,
        description: primaryTrans.description?.trim() || fallbackTrans?.description?.trim() || null,
        translations: Object.keys(translationsData).length > 0 ? translationsData : null,
        category_id: form.category_id || null,
        price: parseFloat(form.price),
        discount_price:
          form.discountType === "price" && form.discount_price
            ? parseFloat(form.discount_price)
            : null,
        discount_percentage:
          form.discountType === "percentage" && form.discount_percentage
            ? parseFloat(form.discount_percentage)
            : null,
        stock: parseInt(form.stock, 10),
        status: form.status,
        is_featured: form.is_featured,
        // Strip incomplete entries so Zod min(1) never fails
        colors: (() => {
          const valid = form.colors.filter((c) => c.name.trim() && c.hex.trim());
          return valid.length > 0 ? valid : null;
        })(),
        sizes: (() => {
          const valid = form.sizes.map((s) => s.trim()).filter(Boolean);
          return valid.length > 0 ? valid : null;
        })(),
        // Dynamic Product Sections — server sanitizes the array further.
        use_default_sections: form.use_default_sections !== false,
        sections_config:
          form.use_default_sections === false && Array.isArray(form.sections_config)
            ? form.sections_config
            : null,
      };

      // 1. Create or update product
      const method = isEdit ? "PUT" : "POST";
      const url = isEdit
        ? `/api/v1/products/${product.id}`
        : "/api/v1/products";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save product");

      const savedProduct = json.data;
      const productId = savedProduct.id;

      const supabase = createClient();

      // 2. If editing: delete removed existing images
      if (isEdit && product?.images) {
        const originalIds = new Set(product.images.map((img) => img.id));
        const remainingIds = new Set(existingImages.map((img) => img.id));
        const toDelete = [...originalIds].filter((id) => !remainingIds.has(id));
        await Promise.all(
          toDelete.map((imageId) =>
            fetch(`/api/v1/products/${productId}/images/${imageId}`, {
              method: "DELETE",
            })
          )
        );
      }

      // 3. Update main image for existing images
      if (isEdit) {
        const newMain = existingImages.find((img) => img.is_main);
        const originalMain = product?.images?.find((img) => img.is_main);
        if (newMain && newMain.id !== originalMain?.id) {
          await fetch(`/api/v1/products/${productId}/images/${newMain.id}`, {
            method: "PATCH",
          });
        }
      }

      // 4. Upload pending images
      let pendingMainIndex = pendingImages.findIndex((img) => img.isMain);
      const hasExistingMain =
        existingImages.some((img) => img.is_main) ||
        (isEdit && existingImages.length > 0);

      for (let i = 0; i < pendingImages.length; i++) {
        const img = pendingImages[i];
        const storagePath = await uploadToStorage(supabase, productId, img.file, i);
        const isMain =
          img.isMain ||
          (!hasExistingMain && pendingMainIndex === -1 && i === 0);
        await fetch(`/api/v1/products/${productId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath, isMain, displayOrder: i }),
        });
      }

      onSaved?.(savedProduct);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || typeof document === "undefined") return null;

  const f = (field) => (e) =>
    dispatch({
      type: "set",
      field,
      value: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    });

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out ${animOpen ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Panel — slides in from right on desktop, up from bottom on mobile */}
      <div
        ref={panelRef}
        className={`
          relative mt-auto ms-auto flex w-full flex-col bg-white shadow-2xl overflow-hidden
          transition-transform duration-300
          h-[92dvh] rounded-t-2xl max-w-full
          sm:h-full sm:max-w-2xl sm:rounded-none
          ${animOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"}
        `}
        style={{ transitionTimingFunction: animOpen ? "cubic-bezier(0.32,0.72,0,1)" : "cubic-bezier(0.72,0,0.68,1)" }}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-zinc-900">
            {isEdit ? (t.edit_title ?? "Edit Product") : (t.add_title ?? "Add Product")}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="hidden sm:flex rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form
          id="product-form"
          onSubmit={handleSave}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Details ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-2">
              {t.section_details ?? "Product Details"}
            </h3>

            {/* Language tab switcher */}
            <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">
              {SUPPORTED_LANGS.map((lang) => {
                const hasContent = form.translations[lang]?.name?.trim();
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveLang(lang)}
                    className={`relative flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      activeLang === lang
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {LANG_LABELS[lang]}
                    {hasContent && (
                      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.name_label ?? "Name"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.translations[activeLang]?.name ?? ""}
                onChange={(e) =>
                  dispatch({ type: "set_translation", lang: activeLang, field: "name", value: e.target.value })
                }
                dir={RTL_LANGS.has(activeLang) ? "rtl" : "ltr"}
                placeholder={t.name_placeholder ?? "e.g. Product name"}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.category_label ?? "Category"}
              </label>
              <div className="flex gap-2">
                {/* Custom dropdown trigger */}
                <button
                  ref={catBtnRef}
                  type="button"
                  onClick={openCatDropdown}
                  className="flex-1 flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-start focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:bg-zinc-50"
                >
                  <span className={form.category_id ? "text-zinc-900" : "text-zinc-400"}>
                    {form.category_id
                      ? (categories.find((c) => c.id === form.category_id)?.name ?? (t.category_none ?? "No category"))
                      : (t.category_none ?? "No category")}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform ${catOpen ? "rotate-180" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewCat((v) => !v)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
                >
                  {t.category_new ?? "+ New"}
                </button>
              </div>

              {/* Custom dropdown panel via portal */}
              {catOpen && createPortal(
                <div
                  ref={catPanelRef}
                  style={{ position: "fixed", top: catCoords.top, left: catCoords.left, width: catCoords.width, zIndex: 9999 }}
                  className="rounded-xl border border-zinc-100 bg-white shadow-xl py-1.5 overflow-hidden"
                >
                  {[{ id: "", name: t.category_none ?? "No category" }, ...categories].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        dispatch({ type: "set", field: "category_id", value: cat.id });
                        setCatOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-zinc-50 ${
                        form.category_id === cat.id ? "text-zinc-900 font-medium" : "text-zinc-600"
                      }`}
                    >
                      <span>{cat.name}</span>
                      {form.category_id === cat.id && <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                    </button>
                  ))}
                </div>,
                document.body
              )}

              {showNewCat && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder={t.category_name_placeholder ?? "Category name"}
                    className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={addingCategory || !newCategoryName.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingCategory ? "..." : (t.category_add ?? "Add")}
                  </button>
                </div>
              )}
            </div>

            {/* Short Description */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.short_description_label ?? "Short Description"}
              </label>
              <textarea
                value={form.translations[activeLang]?.short_description ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "set_translation",
                    lang: activeLang,
                    field: "short_description",
                    value: e.target.value,
                  })
                }
                dir={RTL_LANGS.has(activeLang) ? "rtl" : "ltr"}
                rows={2}
                placeholder={t.short_description_placeholder ?? "Brief product summary..."}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Long Description */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.description_label ?? "Long Description"}
              </label>
              <textarea
                value={form.translations[activeLang]?.description ?? ""}
                onChange={(e) =>
                  dispatch({ type: "set_translation", lang: activeLang, field: "description", value: e.target.value })
                }
                dir={RTL_LANGS.has(activeLang) ? "rtl" : "ltr"}
                rows={3}
                placeholder={t.description_placeholder ?? "Detailed product description..."}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Price + Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {t.price_label ?? "Price (DH)"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.price}
                  onChange={f("price")}
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {t.stock_label ?? "Stock"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={f("stock")}
                  required
                  min="0"
                  step="1"
                  placeholder="0"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Discount */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t.discount_label ?? "Discount"}
              </label>
              <div className="flex gap-3 mb-3">
                {[
                  { val: "none",       label: t.discount_none       ?? "None" },
                  { val: "price",      label: t.discount_fixed      ?? "Fixed price" },
                  { val: "percentage", label: t.discount_percentage ?? "Percentage" },
                ].map(({ val, label }) => (
                  <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="discountType"
                      value={val}
                      checked={form.discountType === val}
                      onChange={f("discountType")}
                      className="accent-blue-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {form.discountType === "price" && (
                <input
                  type="number"
                  value={form.discount_price}
                  onChange={f("discount_price")}
                  min="0"
                  step="0.01"
                  placeholder={t.discount_price_placeholder ?? "Discounted price (e.g. 79.99)"}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              {form.discountType === "percentage" && (
                <input
                  type="number"
                  value={form.discount_percentage}
                  onChange={f("discount_percentage")}
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder={t.discount_pct_placeholder ?? "Discount % (e.g. 20)"}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {/* Status + Featured */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  {t.status_label ?? "Status"}
                </label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((s) => {
                    const style = STATUS_STYLES[s];
                    const label = t[`status_${s}`] ?? (s.charAt(0).toUpperCase() + s.slice(1));
                    const isActive = form.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => dispatch({ type: "set", field: "status", value: s })}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? style.pill
                            : "border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full shrink-0 ${
                          isActive ? style.dot : "bg-zinc-300"
                        }`} />
                        {label}
                        {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={f("is_featured")}
                    className="h-4 w-4 rounded accent-blue-600"
                  />
                  {t.featured_label ?? "Featured on homepage"}
                </label>
              </div>
            </div>
          </section>

          {/* ── Images ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-2">
              {t.section_images ?? "Images"}
            </h3>
            <ImageManager
              existingImages={existingImages}
              pendingImages={pendingImages}
              onAddPending={handleAddPending}
              onRemovePending={handleRemovePending}
              onSetPendingMain={handleSetPendingMain}
              onRemoveExisting={handleRemoveExisting}
              onSetExistingMain={handleSetExistingMain}
            />
          </section>

          {/* ── Variants (Colors & Sizes) ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-2">
              {t.section_variants ?? "Variants"} <span className="text-xs font-normal text-zinc-400">({t.variants_optional ?? "optional"})</span>
            </h3>

            {/* Colors */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t.colors_label ?? "Colors"}
              </label>
              <div className="space-y-2">
                {form.colors.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={c.hex}
                      onChange={(e) => {
                        const next = [...form.colors];
                        next[idx] = { ...next[idx], hex: e.target.value };
                        dispatch({ type: "set", field: "colors", value: next });
                      }}
                      className="h-9 w-12 rounded border border-zinc-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) => {
                        const next = [...form.colors];
                        next[idx] = { ...next[idx], name: e.target.value };
                        dispatch({ type: "set", field: "colors", value: next });
                      }}
                      placeholder={t.color_name_placeholder ?? "Color name (e.g. Royal Brown)"}
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.colors.filter((_, i) => i !== idx);
                        dispatch({ type: "set", field: "colors", value: next });
                      }}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const next = [...form.colors, { name: "", hex: "#000000" }];
                    dispatch({ type: "set", field: "colors", value: next });
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {t.add_color ?? "+ Add color"}
                </button>
              </div>
            </div>

            {/* Sizes */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t.sizes_label ?? "Sizes"}
              </label>
              <div className="space-y-2">
                {form.sizes.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={s}
                      onChange={(e) => {
                        const next = [...form.sizes];
                        next[idx] = e.target.value;
                        dispatch({ type: "set", field: "sizes", value: next });
                      }}
                      placeholder={t.size_placeholder ?? "Size (e.g. M, 42, XL)"}
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.sizes.filter((_, i) => i !== idx);
                        dispatch({ type: "set", field: "sizes", value: next });
                      }}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "set", field: "sizes", value: [...form.sizes, ""] });
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {t.add_size ?? "+ Add size"}
                </button>
              </div>
            </div>
          </section>

          {/* ── Page Sections ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-2">
              {t.section_page_sections ?? "Product Page Sections"}
            </h3>
            <label className="flex items-center justify-between gap-3 cursor-pointer rounded-lg border border-zinc-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  {t.use_default_layout ?? "Use default product layout"}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {t.use_default_layout_hint ?? "Inherit the global sections defined in Store Settings."}
                </p>
              </div>
              {loadingDefaults ? (
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              ) : (
                <input
                  type="checkbox"
                  checked={form.use_default_sections !== false}
                  onChange={(e) => handleToggleDefaultSections(e.target.checked)}
                  className="h-4 w-4 rounded accent-blue-600"
                />
              )}
            </label>
            {form.use_default_sections === false && (
              <SectionsBuilder
                value={form.sections_config}
                onChange={(next) => dispatch({ type: "set", field: "sections_config", value: next })}
                onSave={handleSaveSections}
                onDelete={handleSaveSections}
                emptyText={t.sections_empty ?? "Add sections to customize this product's page."}
              />
            )}
          </section>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {t.cancel ?? "Cancel"}
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? (t.saving ?? "Saving…") : isEdit ? (t.save ?? "Save changes") : (t.save_new ?? "Add product")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
