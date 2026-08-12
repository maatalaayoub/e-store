"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Loader2,
  Tag,
  RefreshCw,
  Percent,
  Banknote,
  Package,
  LayoutGrid,
  ChevronDown,
  Search,
  Check,
  Infinity as InfinityIcon,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";

function generateCode(prefix = "") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return (prefix + out).toUpperCase().slice(0, 20);
}

function formatDateTimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PromoModal({ isOpen, onClose, onSaved, promo, products = [], categories = [] }) {
  const dict = useDictionary();
  const t = dict?.admin?.marketing ?? {};
  const tErr = t.errors ?? {};
  const isEdit = !!promo;

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percentage_off");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [maxOrderAmount, setMaxOrderAmount] = useState("");
  const [appliesTo, setAppliesTo] = useState("all");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [usageLimit, setUsageLimit] = useState("");
  const [unlimitedUsage, setUnlimitedUsage] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  useEffect(() => {
    if (isOpen) setMounted(true);
    else {
      const id = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setCode(isEdit ? promo.code ?? "" : "");
    setDiscountType(isEdit ? promo.discount_type ?? "percentage_off" : "percentage_off");
    setDiscountValue(isEdit ? String(promo.discount_value ?? "") : "");
    setMinOrderAmount(isEdit ? String(promo.min_order_amount ?? 0) : "0");
    setMaxOrderAmount(isEdit ? (promo.max_order_amount != null ? String(promo.max_order_amount) : "") : "");
    setAppliesTo(isEdit ? promo.applies_to ?? "all" : "all");
    setSelectedProductIds(isEdit ? (promo.product_ids ?? []).map(String) : []);
    setSelectedCategoryIds(isEdit ? (promo.category_ids ?? []).map(String) : []);
    setUsageLimit(isEdit ? (promo.usage_limit != null ? String(promo.usage_limit) : "") : "");
    setUnlimitedUsage(isEdit ? promo.usage_limit == null : true);
    setStartsAt(isEdit ? formatDateTimeLocal(promo.starts_at) : "");
    setExpiresAt(isEdit ? formatDateTimeLocal(promo.expires_at) : "");
    setIsActive(isEdit ? promo.is_active !== false : true);
    setProductSearch("");
    setCategorySearch("");
    setError(null);
    setSubmitting(false);
  }, [isOpen, isEdit, promo]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, submitting, onClose]);

  const mapError = (code) => tErr[code] ?? tErr.generic ?? "Something went wrong.";

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.name ?? "").toLowerCase().includes(q));
  }, [products, productSearch]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => (c.name ?? "").toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const validate = () => {
    if (!code.trim()) return tErr.invalid_code;
    const v = Number(discountValue);
    if (!Number.isFinite(v) || v <= 0) return tErr.invalid_discount_value;
    if (discountType === "percentage_off" && v > 100) return tErr.percentage_too_high;
    const mo = Number(minOrderAmount);
    if (!Number.isFinite(mo) || mo < 0) return tErr.invalid_min_order_amount;
    if (maxOrderAmount !== "" && maxOrderAmount != null) {
      const mx = Number(maxOrderAmount);
      if (!Number.isFinite(mx) || mx < 0) return tErr.invalid_max_order_amount;
      if (mx < mo) return tErr.invalid_max_order_amount;
    }
    if (!unlimitedUsage) {
      const ul = Number(usageLimit);
      if (!Number.isFinite(ul) || ul < 1 || !Number.isInteger(ul)) return tErr.invalid_usage_limit;
    }
    if (appliesTo === "products" && selectedProductIds.length === 0) return tErr.product_ids_required;
    if (appliesTo === "categories" && selectedCategoryIds.length === 0) return tErr.category_ids_required;
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) return tErr.invalid_date_range;
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        min_order_amount: Number(minOrderAmount),
        max_order_amount: maxOrderAmount === "" || maxOrderAmount == null ? null : Number(maxOrderAmount),
        starts_at: startsAt || null,
        expires_at: expiresAt || null,
        usage_limit: unlimitedUsage ? null : Number(usageLimit),
        applies_to: appliesTo,
        product_ids: appliesTo === "products" ? selectedProductIds : [],
        category_ids: appliesTo === "categories" ? selectedCategoryIds : [],
        is_active: isActive,
      };
      if (isEdit) payload.id = promo.id;
      const res = await fetch("/api/v1/admin/promos", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(mapError(json.error));
        return;
      }
      toast.success(isEdit ? t.toast_updated ?? "Updated" : t.toast_created ?? "Created");
      onSaved?.();
      onClose?.();
    } catch {
      setError(tErr.generic ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted && !isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] flex items-end justify-center sm:items-center transition-opacity ${
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !submitting && onClose?.()} />
      <div
        className={`relative flex w-full max-h-[92vh] flex-col overflow-hidden bg-white shadow-xl transition-transform rounded-t-2xl sm:max-w-2xl sm:max-h-[90vh] sm:rounded-[5px] ${
          isOpen ? "translate-y-0" : "translate-y-full sm:translate-y-4"
        }`}
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-300" />
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[5px] bg-blue-50 text-blue-600">
              <Tag className="h-5 w-5" />
            </span>
            <h2 className="text-base font-semibold text-zinc-900">
              {isEdit ? t.form?.title_edit ?? "Edit promo code" : t.form?.title_create ?? "Create promo code"}
            </h2>
          </div>
          <button type="button" onClick={() => !submitting && onClose?.()} className="text-zinc-400 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Code + generator */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                {t.form?.code_label ?? "Code"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={t.form?.code_placeholder ?? "SUMMER25"}
                  className="flex-1 rounded-[5px] border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setCode(generateCode())}
                  className="inline-flex items-center gap-1.5 rounded-[5px] border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t.generate_button ?? "Generate"}
                </button>
              </div>
            </div>

            {/* Discount type + value */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  {t.form?.discount_type_label ?? "Discount type"}
                </label>
                <div className="flex rounded-[5px] border border-zinc-200 p-1">
                  {[
                    { key: "percentage_off", Icon: Percent, label: t.form?.percentage_off ?? "%" },
                    { key: "fixed_amount", Icon: Banknote, label: t.form?.fixed_amount ?? "Fixed" },
                  ].map(({ key, Icon, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDiscountType(key)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                        discountType === key ? "bg-blue-600 text-white" : "text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  {t.form?.discount_value_label ?? "Discount value"}
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={discountType === "percentage_off" ? 100 : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Min order + max discount */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  {t.form?.min_order_label ?? "Min order amount"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  {t.form?.max_order_label ?? "Maximum order amount"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxOrderAmount}
                  onChange={(e) => setMaxOrderAmount(e.target.value)}
                  placeholder={t.form?.max_order_hint ?? "Optional — no upper limit"}
                  className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Applies to + selectors */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                {t.form?.applies_to_label ?? "Applies to"}
              </label>
              <select
                value={appliesTo}
                onChange={(e) => setAppliesTo(e.target.value)}
                className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
              >
                <option value="all">{t.form?.applies_to_all ?? "All products"}</option>
                <option value="products">{t.form?.applies_to_products ?? "Selected products"}</option>
                <option value="categories">{t.form?.applies_to_categories ?? "Selected categories"}</option>
              </select>

              {appliesTo === "products" && (
                <div className="mt-3 rounded-[5px] border border-zinc-200 p-3">
                  <div className="relative mb-2">
                    <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder={t.form?.select_products ?? "Search products"}
                      className="w-full rounded-[5px] border border-zinc-200 ps-9 pe-3 py-1.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredProducts.map((p) => {
                      const checked = selectedProductIds.includes(String(p.id));
                      return (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedProductIds((prev) =>
                                e.target.checked
                                  ? [...prev, String(p.id)]
                                  : prev.filter((id) => id !== String(p.id))
                              );
                            }}
                            className="h-4 w-4 rounded border-zinc-300 text-blue-600"
                          />
                          <span className="text-sm text-zinc-800">{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {appliesTo === "categories" && (
                <div className="mt-3 rounded-[5px] border border-zinc-200 p-3">
                  <div className="relative mb-2">
                    <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder={t.form?.select_categories ?? "Search categories"}
                      className="w-full rounded-[5px] border border-zinc-200 ps-9 pe-3 py-1.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredCategories.map((c) => {
                      const checked = selectedCategoryIds.includes(String(c.id));
                      return (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedCategoryIds((prev) =>
                                e.target.checked
                                  ? [...prev, String(c.id)]
                                  : prev.filter((id) => id !== String(c.id))
                              );
                            }}
                            className="h-4 w-4 rounded border-zinc-300 text-blue-600"
                          />
                          <span className="text-sm text-zinc-800">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Usage limit + dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  {t.form?.usage_limit_label ?? "Usage limit"}
                </label>
                <div className="mb-2 flex rounded-[5px] border border-zinc-200 p-1">
                  {[
                    { key: "unlimited", Icon: InfinityIcon, label: t.form?.usage_unlimited_label ?? "Unlimited" },
                    { key: "limited", Icon: Hash, label: t.form?.usage_limited_label ?? "Limited" },
                  ].map(({ key, Icon, label }) => {
                    const active = key === "unlimited" ? unlimitedUsage : !unlimitedUsage;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (key === "unlimited") {
                            setUnlimitedUsage(true);
                            setUsageLimit("");
                          } else {
                            setUnlimitedUsage(false);
                            if (!usageLimit) setUsageLimit("100");
                          }
                        }}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                          active ? "bg-blue-600 text-white" : "text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    );
                  })}
                </div>
                {!unlimitedUsage && (
                  <>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={usageLimit}
                      onChange={(e) => setUsageLimit(e.target.value)}
                      placeholder={t.form?.usage_limit_hint ?? "e.g. 100"}
                      className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      dir="ltr"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[10, 50, 100, 500, 1000].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setUsageLimit(String(n))}
                          className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                            Number(usageLimit) === n
                              ? "border-blue-600 bg-blue-50 text-blue-700"
                              : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  {t.form?.starts_at_label ?? "Start date"}
                </label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  {t.form?.expires_at_label ?? "Expiry date"}
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Active toggle */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600"
              />
              <span className="text-sm font-medium text-zinc-700">{t.form?.active_label ?? "Active"}</span>
            </label>

            {error && (
              <p className="rounded-[5px] bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-100 bg-white px-6 py-4">
            <button
              type="button"
              onClick={() => !submitting && onClose?.()}
              className="rounded-[5px] px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              {dict?.common?.close ?? "Close"}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-[5px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? t.form?.title_edit ?? "Save" : t.add_button ?? "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
