"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Check, ChevronDown, X, Loader2, AlertCircle, Tag, ImagePlus, ImageOff, Search,
  Shirt, SprayCan, Cpu, Bike, Gauge, Pill, Wrench, Car, WashingMachine, Sofa, Download, Shapes, Package,
  Tv, Smartphone, Tablet, Watch, Laptop, HardDrive, Gamepad2, Monitor, Camera, Headphones, Speaker, Router, Keyboard, Mouse, Printer,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import ImageManager from "./ImageManager";
import SectionsBuilder from "@/components/admin/product-sections/SectionsBuilder";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";
import { RTL_LOCALES } from "@/config/constants";
import { listProductTypes, getVariantAxes } from "@/config/product-types";
import { getAttributeSchema, getDeviceTypes, getVariantDimensions } from "@/config/product-types/attributes";
import { attrLabel } from "@/lib/product-attributes";
import { compressImageFile } from "@/lib/image-compress";
import VariantBuilder from "./VariantBuilder";
import ColorPicker from "@/components/admin/ColorPicker";
import { findColorByHex } from "@/config/colors";
import {
  ACCEPTED_CATEGORY_IMAGE_TYPES,
  uploadCategoryImage,
  validateCategoryImage,
} from "./categoryImageUpload";
import {
  resolveCategoryName,
  CATEGORY_SUPPORTED_LANGS,
  emptyCategoryNames,
  canonicalCategoryName,
  categoryTranslationsPayload,
} from "@/lib/category-locale";

// ── helpers ─────────────────────────────────────────────────────────────────────
const SUPPORTED_LANGS = ["en", "fr", "ar", "dr"];
const LANG_LABELS = { en: "English", fr: "Français", ar: "العربية", dr: "الدارجة" };
const CATEGORY_LANG_LABELS = { en: "EN", fr: "FR", ar: "AR", dr: "DR" };
const RTL_LANGS = new Set(RTL_LOCALES);

// Maps the string icon names stored in the product-type config to their
// lucide-react components. Keeps the config module serializable/server-safe.
const TYPE_ICONS = {
  Shirt, SprayCan, Cpu, Bike, Gauge, Pill, Wrench, Car, WashingMachine, Sofa, Download, Shapes, Package,
};

// Icons for the electronics device-type picker.
const DEVICE_ICONS = {
  Tv, Smartphone, Tablet, Watch, Laptop, HardDrive, Gamepad2, Monitor, Camera, Headphones, Speaker, Router, Keyboard, Mouse, Printer, Cpu,
};

/**
 * Small 24×24 category icon used in the category picker (trigger + dropdown).
 * Falls back to a neutral Tag glyph when the category has no `image_url`,
 * matching the visual language of `CategoriesManagerModal`.
 */
function CategoryThumb({ src, name }) {
  if (src) {
    return (
      // Small user-uploaded thumbnail — `next/image` isn't worth its overhead
      // for a 24px icon rendered inside a dropdown list.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ""}
        loading="lazy"
        className="h-6 w-6 rounded-md object-cover bg-zinc-100 shrink-0"
      />
    );
  }
  return (
    <span className="grid h-6 w-6 place-items-center rounded-md bg-zinc-100 text-zinc-400 shrink-0">
      <Tag className="h-3.5 w-3.5" />
    </span>
  );
}

function emptyTranslations() {
  return Object.fromEntries(
    SUPPORTED_LANGS.map((l) => [l, { name: "", short_description: "", description: "" }])
  );
}

// Renders a single dynamic product attribute from its schema field spec.
// One component per field type keeps rendering config-driven (no scattered
// per-attribute conditionals).
function AttributeField({ field, value, label, optionLabels, onChange }) {
  const inputCls =
    "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded accent-blue-600"
        />
        {label}
      </label>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
      {field.type === "select" ? (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          <option value="">—</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {optionLabels?.[`${field.key}_${opt.value}`] ?? opt.label ?? opt.value}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ""}
          className={inputCls}
        />
      )}
    </div>
  );
}

const initialForm = {
  translations: emptyTranslations(),
  category_id: "",
  product_type: "",
  attributes: {},
  variants: null,
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
    case "set_attribute":
      return {
        ...state,
        attributes: { ...state.attributes, [action.key]: action.value },
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
    product_type: p.product_type ?? "",
    attributes: p.attributes && typeof p.attributes === "object" ? { ...p.attributes } : {},
    price: p.price != null ? String(p.price) : "",
    discountType,
    discount_price: p.discount_price != null ? String(p.discount_price) : "",
    discount_percentage:
      p.discount_percentage != null ? String(p.discount_percentage) : "",
    stock: p.stock != null ? String(p.stock) : "",
    status: p.status ?? "draft",
    is_featured: p.is_featured ?? false,
    // Normalize stored colors: try to match hex → predefined name so the
    // color picker shows the correct name & swatch when editing a product.
    colors: Array.isArray(p.colors)
      ? p.colors.map((c) => {
          if (!c?.hex) return c;
          const predefined = findColorByHex(c.hex);
          return predefined ? { name: predefined.name, hex: predefined.hex } : c;
        })
      : [],
    sizes: Array.isArray(p.sizes) ? p.sizes : [],
    variants: p.variants && typeof p.variants === "object" ? p.variants : null,
    use_default_sections: p.use_default_sections !== false,
    sections_config: Array.isArray(p.sections_config) ? p.sections_config : [],
  };
}

async function uploadToStorage(supabase, productId, file, index) {
  // Downscale + re-encode before upload so Next's image optimizer can fetch
  // the stored object without timing out on multi-MB originals.
  const toUpload = await compressImageFile(file).catch(() => file);
  const ext = toUpload.name.split(".").pop();
  const path = `products/${productId}/${Date.now()}_${index}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, toUpload, { upsert: false, contentType: toUpload.type });
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
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [typeSearch, setTypeSearch] = useState("");
  const [newCategoryNames, setNewCategoryNames] = useState(() => emptyCategoryNames());
  const [newCategoryLang, setNewCategoryLang] = useState("en");
  const [newCategoryImageFile, setNewCategoryImageFile] = useState(null);
  const [newCategoryImagePreview, setNewCategoryImagePreview] = useState(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [catCoords, setCatCoords] = useState({ top: 0, left: 0, width: 0 });
  const catBtnRef = useRef(null);
  const catPanelRef = useRef(null);
  const newCategoryFileInputRef = useRef(null);
  const panelRef = useRef(null);

  const params = useParams();
  const locale = params?.locale || "en";
  const [activeLang, setActiveLang] = useState(locale);
  const dict = useDictionary();
  const { dir } = useLocale();
  const t = dict?.admin?.products?.form ?? {};
  // Category-icon labels are shared with the manager modal; reuse those keys
  // rather than duplicating them under `form.*`.
  const tc = dict?.admin?.products?.categories_manager ?? {};

  const STATUS_STYLES = {
    active:   { pill: "border-emerald-300 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
    draft:    { pill: "border-zinc-300 bg-zinc-100 text-zinc-600",         dot: "bg-zinc-400"   },
    archived: { pill: "border-amber-300 bg-amber-50 text-amber-700",       dot: "bg-amber-400"  },
  };
  const STATUS_OPTIONS = ["active", "draft", "archived"];

  const isEdit = Boolean(product?.id);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  // Wizard steps. In create mode the user advances with Next (each step is
  // gated by validation); in edit mode every step is a freely-clickable tab.
  const STEPS = [
    { id: "type", label: t.step_type ?? "Product Type" },
    { id: "info", label: t.step_info ?? "Product Information" },
    { id: "pricing", label: t.step_pricing ?? "Pricing & Inventory" },
    { id: "images", label: t.step_images ?? "Product Images" },
    { id: "sections", label: t.step_sections ?? "Page Sections", optional: true },
  ];
  const lastStep = STEPS.length - 1;

  const hasAnyName = () => SUPPORTED_LANGS.some((l) => form.translations[l]?.name?.trim());

  /** Validate a step's required fields. Returns an error string or null. */
  function validateStep(index) {
    if (index === 0) {
      if (!form.product_type) return t.type_required ?? "Please select a product type to continue.";
    }
    if (index === 1) {
      if (!hasAnyName()) return t.name_required ?? "Product name is required in at least one language.";
      // Electronics requires a device type before its specs can be filled.
      if (form.product_type === "electronics" && !form.attributes?.device_type) {
        return t.device_type_required ?? "Please select a device type.";
      }
      // Schema-driven required attributes for the selected product type.
      for (const group of getAttributeSchema(form.product_type, form.attributes?.device_type)) {
        for (const field of group.fields) {
          if (!field.required) continue;
          const v = form.attributes?.[field.key];
          if (v == null || v === "" || v === false) {
            const lbl = attrLabel(dict, field.key, field.label);
            return (t.attr_required ?? "{field} is required.").replace("{field}", lbl);
          }
        }
      }
    }
    if (index === 2) {
      if (form.price === "" || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0)
        return t.price_required ?? "A valid price is required.";
      if (form.stock === "" || isNaN(parseInt(form.stock, 10)) || parseInt(form.stock, 10) < 0)
        return t.stock_required ?? "A valid stock quantity is required.";
    }
    return null;
  }

  const canJumpTo = useCallback(
    (index) => isEdit || index <= maxReached,
    [isEdit, maxReached],
  );

  function goToStep(index) {
    if (index < 0 || index > lastStep) return;
    if (!canJumpTo(index)) return;
    setError(null);
    setStep(index);
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const next = Math.min(step + 1, lastStep);
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }


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

  // Drive open/close animation state. `mounted` is set here so the modal
  // stays in the DOM long enough for the exit transition to finish.
  /* eslint-disable react-hooks/set-state-in-effect -- modal lifecycle effect intentionally drives animation/form state */
  useEffect(() => {
    if (open) {
      setMounted(true);
      setStep(0);
      setMaxReached(product?.id ? 4 : 0);
      setTypeSearch("");
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimOpen(true)));
      return () => cancelAnimationFrame(raf);
    }
    setAnimOpen(false);
    const t = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(t);
  }, [open, product?.id]);

  // Sync form when the modal opens. For edit, load the product; for create,
  // reset every field so a previously-added product's data never lingers.
  useEffect(() => {
    if (!open) return;
    setActiveLang(locale);
    if (product) {
      dispatch({ type: "reset", payload: productToForm(product) });
    } else {
      dispatch({ type: "reset", payload: {} });
    }
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
    setNewCategoryNames(emptyCategoryNames());
    setNewCategoryLang(CATEGORY_SUPPORTED_LANGS.includes(locale) ? locale : "en");
    // Reset the inline new-category image picker (revoke the previous preview
    // URL if there was one so it doesn't leak).
    if (newCategoryImagePreview) URL.revokeObjectURL(newCategoryImagePreview);
    setNewCategoryImageFile(null);
    setNewCategoryImagePreview(null);
  }, [open, product, locale]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  async function handleReplaceExisting(imageId, file) {
    // Mark the existing image for replacement; the actual storage swap happens on save.
    setExistingImages((prev) =>
      prev.map((img) =>
        img.id === imageId ? { ...img, _replacementFile: file, _replacementPreview: URL.createObjectURL(file) } : img
      )
    );
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

  // Keep the fixed-positioned panel glued to the trigger button when the user
  // scrolls the drawer (or resizes the window). Scroll listener uses capture
  // so it fires for the drawer's inner scroll container too — not just window.
  // If the trigger is scrolled out of view, close instead of trailing offscreen.
  useEffect(() => {
    if (!catOpen) return;
    const reposition = () => {
      const btn = catBtnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const outOfView =
        rect.bottom < 0 ||
        rect.top > (window.innerHeight || document.documentElement.clientHeight);
      if (outOfView) {
        setCatOpen(false);
        return;
      }
      setCatCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [catOpen]);

  function openCatDropdown() {
    const rect = catBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setCatCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setCatOpen((v) => !v);
  }

  // ── category creation ───────────────────────────────────────────────────────
  function handleNewCategoryImagePick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    const err = validateCategoryImage(file);
    if (err === "invalid_type") {
      toast.error(tc.image_invalid_type ?? "Unsupported image type");
      return;
    }
    if (err === "too_large") {
      toast.error(tc.image_too_large ?? "Image is too large (max 3 MB)");
      return;
    }
    if (newCategoryImagePreview) URL.revokeObjectURL(newCategoryImagePreview);
    setNewCategoryImageFile(file);
    setNewCategoryImagePreview(URL.createObjectURL(file));
  }

  function clearNewCategoryImage() {
    if (newCategoryImagePreview) URL.revokeObjectURL(newCategoryImagePreview);
    setNewCategoryImageFile(null);
    setNewCategoryImagePreview(null);
  }

  // Revoke the picker preview URL on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      if (newCategoryImagePreview) URL.revokeObjectURL(newCategoryImagePreview);
    };
  }, [newCategoryImagePreview]);

  async function handleCreateCategory() {
    const canonical = canonicalCategoryName(newCategoryNames);
    if (!canonical) return;
    setAddingCategory(true);
    try {
      let image_path = null;
      if (newCategoryImageFile) {
        try {
          image_path = await uploadCategoryImage(newCategoryImageFile);
        } catch (uploadErr) {
          throw new Error(
            uploadErr?.message || (tc.image_upload_failed ?? "Image upload failed"),
          );
        }
      }
      const res = await fetch("/api/v1/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: canonical,
          image_path,
          translations: categoryTranslationsPayload(newCategoryNames),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create category");
      onCategoryCreated?.(json.data);
      dispatch({ type: "set", field: "category_id", value: json.data.id });
      setNewCategoryNames(emptyCategoryNames());
      clearNewCategoryImage();
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
    // In create mode, submitting (e.g. pressing Enter) on a non-final step
    // advances the wizard instead of saving.
    if (!isEdit && step < lastStep) {
      goNext();
      return;
    }
    setError(null);
    setSaving(true);

    try {
      // Derive primary name/description from translations
      const primaryTrans = form.translations[locale] ?? {};
      const fallbackTrans = SUPPORTED_LANGS.map((l) => form.translations[l]).find((tr) => tr?.name?.trim());
      const primaryName = primaryTrans.name?.trim() || fallbackTrans?.name?.trim() || "";
      if (!primaryName) {
        setError(t.name_required ?? "Product name is required in at least one language.");
        setStep(1);
        setSaving(false);
        return;
      }

      if (form.price === "" || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
        setError(t.price_required ?? "A valid price is required.");
        setStep(2);
        setSaving(false);
        return;
      }
      if (form.stock === "" || isNaN(parseInt(form.stock, 10)) || parseInt(form.stock, 10) < 0) {
        setError(t.stock_required ?? "A valid stock quantity is required.");
        setStep(2);
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
        category_id: form.category_id ? form.category_id.trim() : null,
        product_type: form.product_type || null,
        attributes: form.product_type && form.attributes && Object.keys(form.attributes).length > 0
          ? form.attributes
          : null,
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
        // Variant editors are gated by the type's variantAxes — only persist a
        // variant dimension the selected type actually supports.
        colors: (() => {
          if (form.product_type && !getVariantAxes(form.product_type).includes("color")) return null;
          const valid = form.colors.filter((c) => c.name.trim() && c.hex.trim());
          return valid.length > 0 ? valid : null;
        })(),
        sizes: (() => {
          if (form.product_type && !getVariantAxes(form.product_type).includes("size")) return null;
          const valid = form.sizes.map((s) => s.trim()).filter(Boolean);
          return valid.length > 0 ? valid : null;
        })(),
        // RAM/Storage configuration variants — only for types/devices that
        // support them; sanitized + repriced server-side.
        variants: getVariantDimensions(form.product_type, form.attributes?.device_type).length > 0
          ? form.variants
          : null,
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

      // 4. Replace existing images marked for replacement
      if (isEdit) {
        const toReplace = existingImages.filter((img) => img._replacementFile);
        for (const img of toReplace) {
          const storagePath = await uploadToStorage(supabase, productId, img._replacementFile, `replace_${img.id}`);
          await fetch(`/api/v1/products/${productId}/images/${img.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storagePath }),
          });
        }
      }

      // 5. Upload pending images
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

      toast.success(isEdit ? (t.saved ?? "Product saved") : (t.created ?? "Product created"));
      onSaved?.(savedProduct);
      onClose();
    } catch (err) {
      const message = err?.message || "Failed to save product";
      setError(message);
      toast.error(message);
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

      {/* Panel — slides in from right on desktop for both LTR and RTL, up from bottom on mobile */}
      <div
        ref={panelRef}
        className={`
          relative mt-auto flex w-full flex-col bg-white shadow-2xl overflow-hidden
          transition-transform duration-300
          h-[92dvh] rounded-t-2xl max-w-full
          sm:h-full sm:max-w-2xl sm:rounded-none
          ltr:ms-auto rtl:me-auto
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

        {/* Stepper */}
        <nav
          className="border-b border-zinc-100 px-4 sm:px-6 py-3 shrink-0 overflow-x-auto scrollbar-hide"
          aria-label={t.step_label ?? "Steps"}
        >
          <ol className="flex items-center gap-1 sm:gap-2 min-w-max">
            {STEPS.map((s, i) => {
              const active = step === i;
              const reachable = canJumpTo(i);
              const complete = !active && (isEdit || i < step);
              return (
                <li key={s.id} className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => goToStep(i)}
                    disabled={!reachable}
                    aria-current={active ? "step" : undefined}
                    className={`group inline-flex items-center gap-2 rounded-full px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                      active
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                        : reachable
                          ? "text-zinc-600 hover:bg-zinc-100"
                          : "text-zinc-300 cursor-not-allowed"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 sm:h-6 sm:w-6 place-items-center rounded-full text-[11px] font-bold transition-colors ${
                        active
                          ? "bg-white/20 text-white"
                          : complete
                            ? "bg-emerald-100 text-emerald-600"
                            : reachable
                              ? "bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300"
                              : "bg-zinc-100 text-zinc-300"
                      }`}
                    >
                      {complete ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="whitespace-nowrap">{s.label}</span>
                    {s.optional && (
                      <span
                        className={`hidden sm:inline text-[10px] font-normal ${
                          active ? "text-white/70" : "text-zinc-400"
                        }`}
                      >
                        ({t.step_optional ?? "optional"})
                      </span>
                    )}
                  </button>
                  {i < lastStep && (
                    <span className="h-px w-3 sm:w-6 bg-zinc-200 shrink-0" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

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

          {/* ── Step 1: Product Type ── */}
          {step === 0 && (
          <section className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                {t.type_heading ?? "Select product type"}
              </h3>
              <p className="text-sm text-zinc-500 mt-0.5">
                {t.type_subheading ?? "Choose what kind of product you're adding. This tailors the next steps."}
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={typeSearch}
                onChange={(e) => setTypeSearch(e.target.value)}
                placeholder={t.type_search_placeholder ?? "Search product types…"}
                className="w-full rounded-lg border border-zinc-200 ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Type cards */}
            {(() => {
              const q = typeSearch.trim().toLowerCase();
              const types = listProductTypes().filter((pt) => {
                if (!q) return true;
                const label = (t[pt.labelKey] ?? pt.id).toLowerCase();
                const desc = (t[pt.descKey] ?? "").toLowerCase();
                return label.includes(q) || desc.includes(q);
              });
              if (types.length === 0) {
                return (
                  <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400">
                    {t.type_no_results ?? "No product types match your search."}
                  </p>
                );
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {types.map((pt) => {
                    const Icon = TYPE_ICONS[pt.icon] ?? Package;
                    const selected = form.product_type === pt.id;
                    return (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => dispatch({ type: "set", field: "product_type", value: pt.id })}
                        aria-pressed={selected}
                        className={`group relative flex items-start gap-3 rounded-xl border p-3 text-start transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          selected
                            ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/30"
                            : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors ${
                            selected ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-zinc-900">
                            {t[pt.labelKey] ?? pt.id}
                          </span>
                          <span className="block text-xs text-zinc-500 mt-0.5 leading-snug">
                            {t[pt.descKey] ?? ""}
                          </span>
                        </span>
                        {selected && (
                          <span className="absolute top-2 end-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </section>
          )}

          {/* ── Step 2: Product Information ── */}
          {step === 1 && (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-2">
              {t.section_details ?? "Product Details"}
            </h3>

            {/* Language tab switcher — same pill design as the storefront tabs */}
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label={t.section_details ?? "Product Details"}
            >
              {SUPPORTED_LANGS.map((lang) => {
                const hasContent = !!form.translations[lang]?.name?.trim();
                const isActive = activeLang === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveLang(lang)}
                    dir={RTL_LANGS.has(lang) ? "rtl" : "ltr"}
                    className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 border ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/25"
                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900 hover:bg-zinc-50"
                    }`}
                  >
                    <span>{LANG_LABELS[lang]}</span>
                    {hasContent && (
                      <Check
                        aria-hidden="true"
                        strokeWidth={3}
                        className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-white" : "text-emerald-500"}`}
                      />
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
                  className="flex-1 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-start focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:bg-zinc-50"
                >
                  {(() => {
                    const selected = form.category_id
                      ? categories.find((c) => c.id === form.category_id)
                      : null;
                    const selectedLabel = selected
                      ? (resolveCategoryName(selected, locale) ?? selected.name)
                      : null;
                    return (
                      <>
                        <CategoryThumb src={selected?.image_url ?? null} name={selectedLabel} />
                        <span className={`flex-1 truncate ${selected ? "text-zinc-900" : "text-zinc-400"}`}>
                          {selectedLabel ?? (t.category_none ?? "No category")}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform ${catOpen ? "rotate-180" : ""}`} />
                      </>
                    );
                  })()}
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
                  className="rounded-xl border border-zinc-100 bg-white shadow-xl py-1.5 overflow-hidden max-h-80 overflow-y-auto"
                >
                  {[{ id: "", name: t.category_none ?? "No category", image_url: null }, ...categories].map((cat) => {
                    const label = cat.id
                      ? (resolveCategoryName(cat, locale) ?? cat.name)
                      : cat.name;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          dispatch({ type: "set", field: "category_id", value: cat.id });
                          setCatOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-start transition-colors hover:bg-zinc-50 ${
                          form.category_id === cat.id ? "text-zinc-900 font-medium" : "text-zinc-600"
                        }`}
                      >
                        <CategoryThumb src={cat.image_url} name={label} />
                        <span className="flex-1 truncate">{label}</span>
                        {form.category_id === cat.id && <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>,
                document.body
              )}

              {showNewCat && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={newCategoryFileInputRef}
                      type="file"
                      accept={ACCEPTED_CATEGORY_IMAGE_TYPES}
                      onChange={handleNewCategoryImagePick}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => newCategoryFileInputRef.current?.click()}
                      aria-label={
                        newCategoryImagePreview
                          ? (tc.image_change ?? "Change image")
                          : (tc.image_pick ?? "Add image")
                      }
                      title={
                        newCategoryImagePreview
                          ? (tc.image_change ?? "Change image")
                          : (tc.image_pick ?? "Add image")
                      }
                      className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {newCategoryImagePreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={newCategoryImagePreview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                    </button>
                    {newCategoryImagePreview && (
                      <button
                        type="button"
                        onClick={clearNewCategoryImage}
                        aria-label={tc.image_remove ?? "Remove image"}
                        title={tc.image_remove ?? "Remove image"}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                      >
                        <ImageOff className="h-4 w-4" />
                      </button>
                    )}
                    <input
                      type="text"
                      value={newCategoryNames[newCategoryLang] ?? ""}
                      onChange={(e) =>
                        setNewCategoryNames((prev) => ({ ...prev, [newCategoryLang]: e.target.value }))
                      }
                      dir={RTL_LANGS.has(newCategoryLang) ? "rtl" : "ltr"}
                      maxLength={80}
                      placeholder={t.category_name_placeholder ?? "Category name"}
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={addingCategory || !canonicalCategoryName(newCategoryNames)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addingCategory ? "..." : (t.category_add ?? "Add")}
                    </button>
                  </div>
                  {/* Language tabs — same pill design as the product translation tabs. */}
                  <div
                    className="flex flex-wrap gap-2"
                    role="tablist"
                    aria-label={tc.language ?? "Language"}
                  >
                    {CATEGORY_SUPPORTED_LANGS.map((lang) => {
                      const hasContent = !!newCategoryNames[lang]?.trim();
                      const isActive = newCategoryLang === lang;
                      return (
                        <button
                          key={lang}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setNewCategoryLang(lang)}
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-200 border ${
                            isActive
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/25"
                              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900 hover:bg-zinc-50"
                          }`}
                        >
                          {CATEGORY_LANG_LABELS[lang]}
                          {hasContent && (
                            <Check
                              aria-hidden="true"
                              strokeWidth={3}
                              className={`h-3 w-3 shrink-0 ${isActive ? "text-white" : "text-emerald-500"}`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
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

            {/* Electronics: pick a device type before showing its specs */}
            {form.product_type === "electronics" && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 border-b border-zinc-100 pb-1.5">
                  {t.device_type_label ?? "Device type"}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {getDeviceTypes("electronics").map((d) => {
                    const Icon = DEVICE_ICONS[d.icon] ?? Cpu;
                    const selected = form.attributes?.device_type === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => dispatch({ type: "set_attribute", key: "device_type", value: d.id })}
                        aria-pressed={selected}
                        className={`group relative flex items-center gap-2 rounded-lg border p-2.5 text-start transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          selected
                            ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/30"
                            : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors ${
                            selected ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 text-xs font-medium text-zinc-800 truncate">
                          {dict?.admin?.products?.device_types?.[d.id] ?? d.label}
                        </span>
                        {selected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dynamic, product-type-specific attributes */}
            {getAttributeSchema(form.product_type, form.attributes?.device_type).map((group) => (
              <div key={group.id} className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 border-b border-zinc-100 pb-1.5">
                  {dict?.admin?.products?.attr_groups?.[group.id] ?? group.label}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.fields.map((field) => (
                    <AttributeField
                      key={field.key}
                      field={field}
                      value={form.attributes?.[field.key]}
                      label={attrLabel(dict, field.key, field.label)}
                      optionLabels={dict?.admin?.products?.attr_options}
                      onChange={(value) => dispatch({ type: "set_attribute", key: field.key, value })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
          )}

          {/* ── Step 3: Pricing & Inventory ── */}
          {step === 2 && (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-2">
              {t.section_pricing ?? "Pricing & Inventory"}
            </h3>

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
          )}

          {/* ── Step 4: Images ── */}
          {step === 3 && (
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
              onReplaceExisting={handleReplaceExisting}
            />
          </section>
          )}

          {/* ── RAM / Storage configuration variants (electronics devices) ── */}
          {step === 1 && getVariantDimensions(form.product_type, form.attributes?.device_type).length > 0 && (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-2">
              {t.variants_config ?? "Configuration variants"} <span className="text-xs font-normal text-zinc-400">({t.variants_optional ?? "optional"})</span>
            </h3>
            <VariantBuilder
              dimensions={getVariantDimensions(form.product_type, form.attributes?.device_type)}
              value={form.variants}
              onChange={(next) => dispatch({ type: "set", field: "variants", value: next })}
              t={t}
            />
          </section>
          )}

          {/* ── Variants (Colors & Sizes) — schema-gated per product type ── */}
          {step === 1 && getVariantAxes(form.product_type).length > 0 && (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-2">
              {t.section_variants ?? "Variants"} <span className="text-xs font-normal text-zinc-400">({t.variants_optional ?? "optional"})</span>
            </h3>

            {/* Colors */}
            {getVariantAxes(form.product_type).includes("color") && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t.colors_label ?? "Colors"}
              </label>
              <ColorPicker
                value={form.colors}
                onChange={(next) => dispatch({ type: "set", field: "colors", value: next })}
                t={t}
                locale={locale}
              />
            </div>
            )}

            {/* Sizes */}
            {getVariantAxes(form.product_type).includes("size") && (
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
            )}
          </section>
          )}

          {/* ── Step 5: Page Sections (optional) ── */}
          {step === 4 && (
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
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {t.cancel ?? "Cancel"}
            </button>
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {t.step_back ?? "Back"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step < lastStep && (
              <button
                type="button"
                onClick={goNext}
                className={
                  isEdit
                    ? "rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    : "flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
                }
              >
                {t.step_next ?? "Next"}
              </button>
            )}
            {(isEdit || step === lastStep) && (
              <button
                type="submit"
                form="product-form"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? (t.saving ?? "Saving…") : isEdit ? (t.save ?? "Save changes") : (t.save_new ?? "Add product")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
