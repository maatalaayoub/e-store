"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Tag,
  Plus,
  Loader2,
  Percent,
  Banknote,
  Package,
  LayoutGrid,
  Pencil,
  Trash2,
  Search,
  CalendarClock,
  Users,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";
import PromoModal from "./_components/PromoModal";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

function formatDate(iso, locale) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function statusBadge(promo, t) {
  const now = new Date();
  if (!promo.is_active) return { text: t.badge?.inactive ?? "Inactive", class: "bg-zinc-100 text-zinc-600" };
  if (promo.expires_at && new Date(promo.expires_at) < now) return { text: t.badge?.expired ?? "Expired", class: "bg-red-50 text-red-600" };
  if (promo.starts_at && new Date(promo.starts_at) > now) return { text: t.badge?.scheduled ?? "Scheduled", class: "bg-amber-50 text-amber-600" };
  return { text: t.badge?.active ?? "Active", class: "bg-emerald-50 text-emerald-600" };
}

function appliesText(promo, t) {
  const base = t.applies ?? {};
  if (promo.applies_to === "all") return base.all ?? "All products";
  if (promo.applies_to === "products") {
    const tpl = base.products ?? "{count} selected product(s)";
    return tpl.replace("{count}", String(promo.product_ids?.length ?? 0));
  }
  const tpl = base.categories ?? "{count} selected category(s)";
  return tpl.replace("{count}", String(promo.category_ids?.length ?? 0));
}

export default function AdminMarketingPage() {
  const dict = useDictionary();
  const { locale } = useLocale();
  const t = dict?.admin?.marketing ?? {};
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightedPromoId = searchParams.get("promo");
  const rowRefs = useRef({});
  const autoOpenedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [promos, setPromos] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editPromo, setEditPromo] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const copyCode = useCallback(async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(code);
      toast.success(t.toast?.copied ?? "Copied to clipboard");
      setTimeout(() => {
        setCopiedId((current) => (current === code ? null : current));
      }, 2000);
    } catch {
      toast.error(t.toast?.copy_failed ?? "Copy failed");
    }
  }, [t.toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [promosRes, productsRes, categoriesRes] = await Promise.all([
        fetch("/api/v1/admin/promos"),
        fetch("/api/v1/products?limit=100&status=all"),
        fetch("/api/v1/categories"),
      ]);
      const promosJson = await promosRes.json();
      const productsJson = await productsRes.json();
      const categoriesJson = await categoriesRes.json();

      if (promosJson?.success) setPromos(promosJson.data ?? []);
      else setError(promosJson?.error ?? "Failed to load promos");

      if (productsJson?.success) setProducts(productsJson.data ?? []);
      if (categoriesJson?.success) setCategories(categoriesJson.data ?? []);
    } catch {
      setError("Failed to load marketing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!highlightedPromoId || autoOpenedRef.current || promos.length === 0) return;
    const target = promos.find((p) => p.id === highlightedPromoId);
    if (!target) return;
    autoOpenedRef.current = true;
    requestAnimationFrame(() => {
      rowRefs.current[target.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [highlightedPromoId, promos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promos;
    return promos.filter((p) => (p.code ?? "").toLowerCase().includes(q));
  }, [promos, search]);

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/v1/admin/promos?id=${encodeURIComponent(removeTarget.id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      toast.success(t.toast_deleted ?? "Promo code deleted");
      setPromos((prev) => prev.filter((p) => p.id !== removeTarget.id));
      setRemoveTarget(null);
    } catch {
      toast.error(t.errors?.generic ?? "Failed to delete promo code");
    } finally {
      setRemoving(false);
    }
  };

  const openEdit = (promo) => {
    setEditPromo(promo);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditPromo(null);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{t.title ?? "Marketing"}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t.subtitle ?? "Create promo codes and product discounts."}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {t.add_button ?? "Add promo code"}
        </button>
      </div>

      {error && <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
        <Search className="h-4 w-4 text-zinc-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={dict?.common?.search ?? "Search"}
          className="flex-1 bg-transparent text-sm text-zinc-900 outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <Tag className="h-6 w-6" />
          </span>
          <p className="text-sm font-medium text-zinc-700">{t.empty_title ?? "No promo codes"}</p>
          <p className="mt-1 max-w-sm text-xs text-zinc-500">{t.empty_desc ?? "Create one to get started."}</p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Plus className="h-4 w-4" />
            {t.add_button ?? "Add promo code"}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">{t.columns?.code ?? "Code"}</th>
                <th className="px-4 py-3 font-medium">{t.columns?.discount ?? "Discount"}</th>
                <th className="px-4 py-3 font-medium">{t.columns?.applies_to ?? "Applies to"}</th>
                <th className="px-4 py-3 font-medium">{t.columns?.usage ?? "Usage"}</th>
                <th className="px-4 py-3 font-medium">{t.columns?.status ?? "Status"}</th>
                <th className="px-4 py-3 font-medium">{t.columns?.validity ?? "Validity"}</th>
                <th className="px-4 py-3 font-medium text-end">{dict?.common?.actions ?? "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((promo) => {
                const badge = statusBadge(promo, t);
                const Icon = promo.discount_type === "percentage_off" ? Percent : Banknote;
                return (
                  <tr
                    key={promo.id}
                    ref={(el) => { rowRefs.current[promo.id] = el; }}
                    className={`hover:bg-zinc-50/50 ${highlightedPromoId === promo.id ? "bg-blue-50/60 ring-2 ring-inset ring-blue-200" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyCode(promo.code)}
                          className="rounded border border-zinc-200 p-1 text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-700"
                          aria-label="Copy"
                        >
                          {copiedId === promo.code ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <span className="font-semibold text-zinc-900">{promo.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-zinc-500" />
                        {promo.discount_type === "percentage_off"
                          ? `${promo.discount_value}%`
                          : `${promo.discount_value} MAD`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <span className="inline-flex items-center gap-1.5">
                        {promo.applies_to === "all" ? (
                          <Package className="h-3.5 w-3.5" />
                        ) : promo.applies_to === "categories" ? (
                          <LayoutGrid className="h-3.5 w-3.5" />
                        ) : (
                          <Tag className="h-3.5 w-3.5" />
                        )}
                        {appliesText(promo, t)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {promo.usage_limit != null
                          ? (t.usage_text ?? "{used} / {limit}")
                              .replace("{used}", String(promo.used_count))
                              .replace("{limit}", String(promo.usage_limit))
                          : (t.usage_unlimited ?? "{used} used").replace("{used}", String(promo.used_count))}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge.class}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {promo.starts_at || promo.expires_at
                          ? `${formatDate(promo.starts_at, locale)} – ${formatDate(promo.expires_at, locale)}`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEdit(promo)}
                          className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-100"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setRemoveTarget(promo)}
                          className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PromoModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          if (highlightedPromoId) router.replace(`/${locale}/admin/marketing`, { scroll: false });
        }}
        onSaved={load}
        promo={editPromo}
        products={products}
        categories={categories}
      />

      <ConfirmationDialog
        isOpen={!!removeTarget}
        title={t.confirm_delete_title ?? "Delete promo code?"}
        description={
          removeTarget
            ? (t.confirm_delete_desc ?? "Customers will no longer be able to use {code}.").replace(
                "{code}",
                removeTarget.code
              )
            : ""
        }
        confirmText={dict?.admin?.team?.remove_confirm ?? "Delete"}
        cancelText={dict?.common?.close ?? "Cancel"}
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
        isLoading={removing}
        isDangerous
      />
    </>
  );
}
