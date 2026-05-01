"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ImageManager from "./ImageManager";

// ── helpers ──────────────────────────────────────────────────────────────────
const initialForm = {
  name: "",
  description: "",
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
};

function formReducer(state, action) {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
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
  return {
    name: p.name ?? "",
    description: p.description ?? "",
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
  const [form, dispatch] = useReducer(formReducer, initialForm);
  const [pendingImages, setPendingImages] = useState([]); // { file, preview, isMain }
  const [existingImages, setExistingImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const panelRef = useRef(null);

  const isEdit = Boolean(product?.id);

  // Sync form when product changes
  useEffect(() => {
    if (open) {
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
    }
  }, [open, product]);

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
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
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
        colors: form.colors.length > 0 ? form.colors : null,
        sizes: form.sizes.length > 0 ? form.sizes : null,
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

  if (!open) return null;

  const f = (field) => (e) =>
    dispatch({
      type: "set",
      field,
      value: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    });

  const STATUS_OPTIONS = ["active", "draft", "archived"];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative ms-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-zinc-900">
            {isEdit ? "Edit Product" : "Add Product"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
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
              Product Details
            </h3>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={f("name")}
                required
                minLength={2}
                placeholder="e.g. Premium Wireless Headphones"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Category
              </label>
              <div className="flex gap-2">
                <select
                  value={form.category_id}
                  onChange={f("category_id")}
                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCat((v) => !v)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
                >
                  + New
                </button>
              </div>
              {showNewCat && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={addingCategory || !newCategoryName.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingCategory ? "..." : "Add"}
                  </button>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={f("description")}
                rows={3}
                placeholder="Product description..."
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Price + Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Price ($) <span className="text-red-500">*</span>
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
                  Stock <span className="text-red-500">*</span>
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
                Discount
              </label>
              <div className="flex gap-3 mb-3">
                {[
                  { val: "none", label: "None" },
                  { val: "price", label: "Fixed price" },
                  { val: "percentage", label: "Percentage" },
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
                  placeholder="Discounted price (e.g. 79.99)"
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
                  placeholder="Discount % (e.g. 20)"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {/* Status + Featured */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={f("status")}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={f("is_featured")}
                    className="h-4 w-4 rounded accent-blue-600"
                  />
                  Featured on homepage
                </label>
              </div>
            </div>
          </section>

          {/* ── Variants (Colors & Sizes) ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-2">
              Variants <span className="text-xs font-normal text-zinc-400">(optional)</span>
            </h3>

            {/* Colors */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Colors
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
                      placeholder="Color name (e.g. Royal Brown)"
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
                  + Add color
                </button>
              </div>
            </div>

            {/* Sizes */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Sizes
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
                      placeholder="Size (e.g. M, 42, XL)"
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
                  + Add size
                </button>
              </div>
            </div>
          </section>

          {/* ── Images ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-2">
              Images
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
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add product"}
          </button>
        </div>
      </div>
    </div>
  );
}
