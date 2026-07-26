"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Check,
  Loader2,
  Tag,
  AlertTriangle,
  Package,
  ImagePlus,
  ImageOff,
} from "lucide-react";
import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";
import {
  ACCEPTED_CATEGORY_IMAGE_TYPES as ACCEPTED_IMAGE_TYPES,
  MAX_CATEGORY_IMAGE_BYTES as MAX_IMAGE_BYTES,
  uploadCategoryImage,
} from "./categoryImageUpload";

/**
 * CategoriesManagerModal
 *
 * Admin-only side panel that lists all product categories with their product
 * counts and lets the admin add, rename, delete, and set/change/remove an
 * icon or photo per category. Mirrors the animation and layout of
 * ProductFormModal so the two feel like siblings.
 */
export default function CategoriesManagerModal({ open, onClose, onChanged }) {
  const [animOpen, setAnimOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState(null); // null = loading
  const [newName, setNewName] = useState("");
  const [newImageFile, setNewImageFile] = useState(null);
  const [newImagePreview, setNewImagePreview] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const newInputRef = useRef(null);
  const newFileInputRef = useRef(null);
  const rowFileInputRefs = useRef({});

  const dict = useDictionary();
  const tc = dict?.admin?.products?.categories_manager ?? {};

  /* eslint-disable react-hooks/set-state-in-effect -- modal lifecycle animation */
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimOpen(true)),
      );
      return () => cancelAnimationFrame(raf);
    }
    setAnimOpen(false);
    const t = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(t);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Clean up any pending preview URL to avoid leaks.
  useEffect(() => {
    return () => {
      if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    };
  }, [newImagePreview]);

  const fetchCategories = useCallback(async () => {
    setCategories(null);
    try {
      const res = await fetch("/api/v1/categories?withCounts=1", { cache: "no-store" });
      const json = await res.json();
      setCategories(Array.isArray(json?.data) ? json.data : []);
    } catch {
      setCategories([]);
      toast.error(tc.load_failed ?? "Failed to load categories");
    }
  }, [tc.load_failed]);

  useEffect(() => {
    if (!open) return;
    fetchCategories();
    setNewName("");
    setEditingId(null);
    setEditingName("");
    setDeleteTarget(null);
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(null);
    setNewImagePreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fetchCategories]);

  const handleClose = useCallback(() => {
    setAnimOpen(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  function validateImage(file) {
    if (!file) return false;
    if (!ACCEPTED_IMAGE_TYPES.split(",").includes(file.type)) {
      toast.error(tc.image_invalid_type ?? "Unsupported image type");
      return false;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(tc.image_too_large ?? "Image is too large (max 3 MB)");
      return false;
    }
    return true;
  }

  function handleNewImagePick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file || !validateImage(file)) return;
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(file);
    setNewImagePreview(URL.createObjectURL(file));
  }

  function clearNewImage() {
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(null);
    setNewImagePreview(null);
  }

  async function handleAdd(e) {
    e?.preventDefault?.();
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      let image_path = null;
      if (newImageFile) {
        image_path = await uploadCategoryImage(newImageFile);
      }
      const res = await fetch("/api/v1/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image_path }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || (tc.add_failed ?? "Failed to add category"));
      }
      setCategories((prev) => {
        const next = [...(prev ?? []), { ...json.data, product_count: 0 }];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      setNewName("");
      clearNewImage();
      newInputRef.current?.focus();
      toast.success(tc.added ?? "Category added");
      onChanged?.({ type: "created", category: json.data });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  function startEdit(cat) {
    setEditingId(cat.id);
    setEditingName(cat.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function handleRename(cat) {
    const name = editingName.trim();
    if (!name || name === cat.name) {
      cancelEdit();
      return;
    }
    setSavingId(cat.id);
    try {
      const res = await fetch(`/api/v1/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || (tc.rename_failed ?? "Failed to rename category"));
      }
      applyCategoryUpdate(json.data);
      toast.success(tc.renamed ?? "Category renamed");
      cancelEdit();
      onChanged?.({ type: "updated", category: json.data });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  }

  function applyCategoryUpdate(updated) {
    setCategories((prev) => {
      const next = (prev ?? []).map((c) =>
        c.id === updated.id ? { ...c, ...updated } : c,
      );
      next.sort((a, b) => a.name.localeCompare(b.name));
      return next;
    });
  }

  function triggerRowFilePicker(id) {
    rowFileInputRefs.current[id]?.click();
  }

  async function handleRowImagePick(cat, e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !validateImage(file)) return;
    setUploadingId(cat.id);
    try {
      const image_path = await uploadCategoryImage(file);
      const res = await fetch(`/api/v1/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || (tc.image_upload_failed ?? "Failed to upload image"));
      }
      applyCategoryUpdate(json.data);
      toast.success(tc.image_updated ?? "Category image updated");
      onChanged?.({ type: "updated", category: json.data });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  async function handleRemoveImage(cat) {
    if (!cat.image_path && !cat.image_url) return;
    setUploadingId(cat.id);
    try {
      const res = await fetch(`/api/v1/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: null }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || (tc.image_remove_failed ?? "Failed to remove image"));
      }
      applyCategoryUpdate(json.data);
      toast.success(tc.image_removed ?? "Category image removed");
      onChanged?.({ type: "updated", category: json.data });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/categories/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || (tc.delete_failed ?? "Failed to delete category"));
      }
      setCategories((prev) => (prev ?? []).filter((c) => c.id !== deleteTarget.id));
      toast.success(tc.deleted ?? "Category deleted");
      onChanged?.({ type: "deleted", category: deleteTarget });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out ${
          animOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Panel â€” slides in from right on desktop, up from bottom on mobile */}
      <div
        className={`
          relative mt-auto ms-auto flex w-full flex-col bg-white shadow-2xl overflow-hidden
          transition-transform duration-300
          h-[92dvh] rounded-t-2xl max-w-full
          sm:h-full sm:max-w-lg sm:rounded-none
          ${animOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"}
        `}
        style={{
          transitionTimingFunction: animOpen
            ? "cubic-bezier(0.32,0.72,0,1)"
            : "cubic-bezier(0.72,0,0.68,1)",
        }}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              {tc.title ?? "Manage Categories"}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {tc.subtitle ?? "Add, rename, or remove product categories."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="hidden sm:flex rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label={tc.close ?? "Close"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Add form */}
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 border-b border-zinc-100 px-6 py-4 shrink-0"
        >
          <div className="flex items-center gap-2">
            {/* Icon picker preview / button */}
            <button
              type="button"
              onClick={() => newFileInputRef.current?.click()}
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${
                newImagePreview
                  ? "border-zinc-200"
                  : "border-dashed border-zinc-300 text-zinc-400 hover:border-blue-400 hover:text-blue-600"
              }`}
              aria-label={tc.image_pick ?? "Add icon"}
              title={tc.image_pick ?? "Add icon"}
            >
              {newImagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={newImagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
            </button>
            <input
              ref={newFileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              className="hidden"
              onChange={handleNewImagePick}
            />

            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                ref={newInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={80}
                placeholder={tc.new_placeholder ?? "New category name"}
                className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={!newName.trim() || adding}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>{tc.add ?? "Add"}</span>
            </button>
          </div>
          {newImagePreview && (
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600">
              <span className="truncate">
                {tc.image_selected ?? "Image ready to upload"}
                {newImageFile?.name ? ` â€” ${newImageFile.name}` : ""}
              </span>
              <button
                type="button"
                onClick={clearNewImage}
                className="ms-2 flex items-center gap-1 text-red-500 hover:text-red-600 font-medium"
              >
                <X className="h-3 w-3" />
                {tc.image_remove ?? "Remove"}
              </button>
            </div>
          )}
        </form>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {categories === null && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          )}

          {categories !== null && categories.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-3">
                <Tag className="h-6 w-6" />
              </div>
              <p className="font-medium text-zinc-900 mb-1">
                {tc.empty_title ?? "No categories yet"}
              </p>
              <p className="text-sm text-zinc-500">
                {tc.empty_desc ?? "Add your first category to organize products."}
              </p>
            </div>
          )}

          {categories !== null && categories.length > 0 && (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-white overflow-hidden">
              {categories.map((cat) => {
                const isEditing = editingId === cat.id;
                const isSaving = savingId === cat.id;
                const isUploading = uploadingId === cat.id;
                const busy = isSaving || isUploading;
                return (
                  <li
                    key={cat.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors"
                  >
                    {/* Thumbnail / picker */}
                    <button
                      type="button"
                      onClick={() => !busy && triggerRowFilePicker(cat.id)}
                      disabled={busy}
                      className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition-colors ${
                        cat.image_url
                          ? "border-zinc-200 hover:border-blue-400"
                          : "border-dashed border-zinc-300 bg-blue-50 text-blue-600 hover:border-blue-400"
                      } disabled:opacity-60`}
                      aria-label={cat.image_url ? (tc.image_change ?? "Change image") : (tc.image_pick ?? "Add image")}
                      title={cat.image_url ? (tc.image_change ?? "Change image") : (tc.image_pick ?? "Add image")}
                    >
                      {cat.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" />
                      ) : (
                        <Tag className="h-4 w-4" />
                      )}
                      {isUploading && (
                        <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                        </span>
                      )}
                    </button>
                    <input
                      ref={(el) => { rowFileInputRefs.current[cat.id] = el; }}
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES}
                      className="hidden"
                      onChange={(e) => handleRowImagePick(cat, e)}
                    />

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); handleRename(cat); }
                            else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                          }}
                          maxLength={80}
                          className="w-full rounded-md border border-blue-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                        />
                      ) : (
                        <>
                          <p className="text-sm font-medium text-zinc-900 truncate">{cat.name}</p>
                          <p className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                            <Package className="h-3 w-3" />
                            {cat.product_count === 1
                              ? (tc.count_one ?? "1 product")
                              : (tc.count_other ?? "{n} products").replace("{n}", cat.product_count ?? 0)}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRename(cat)}
                            disabled={isSaving || !editingName.trim()}
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                            aria-label={tc.save ?? "Save"}
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                            aria-label={tc.cancel ?? "Cancel"}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          {cat.image_url && (
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(cat)}
                              disabled={busy}
                              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40"
                              aria-label={tc.image_remove ?? "Remove image"}
                              title={tc.image_remove ?? "Remove image"}
                            >
                              <ImageOff className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(cat)}
                            disabled={busy}
                            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40"
                            aria-label={tc.rename ?? "Rename"}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(cat)}
                            disabled={busy}
                            className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            aria-label={tc.delete ?? "Delete"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Delete confirmation */}
        {deleteTarget && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
            onClick={() => !deleting && setDeleteTarget(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 flex flex-col gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900 text-sm">
                    {(tc.delete_confirm_title ?? "Delete \"{name}\"?").replace(
                      "{name}",
                      deleteTarget.name,
                    )}
                  </p>
                  <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
                    {deleteTarget.product_count > 0
                      ? (tc.delete_confirm_with_products ??
                          "{n} product(s) will keep their data but lose this category.").replace(
                          "{n}",
                          deleteTarget.product_count,
                        )
                      : (tc.delete_confirm_desc ?? "This cannot be undone.")}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {tc.cancel ?? "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tc.delete ?? "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
