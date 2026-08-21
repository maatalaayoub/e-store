"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Filter,
  Mail,
  MapPin,
  Phone,
  Search,
  ShoppingBag,
  UserPlus,
  Users as UsersIcon,
  UserRound,
} from "lucide-react";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";
import { AdminCustomersSkeleton } from "@/components/skeletons";
import AddCustomerModal from "./_components/AddCustomerModal";
import CustomerDrawer from "./_components/CustomerDrawer";

const AVATAR_PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function avatarClass(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function formatCurrency(amount) {
  const value = Number(amount ?? 0);
  const safe = Number.isFinite(value) ? value.toFixed(2) : "0.00";
  return `${safe} MAD`;
}

function formatDate(iso, locale) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatRelative(iso, locale) {
  if (!iso) return null;
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diffMs);
  const min = Math.round(diffMs / 60000);
  const hour = Math.round(diffMs / 3600000);
  const day = Math.round(diffMs / 86400000);
  if (abs < 3600000) return rtf.format(min, "minute");
  if (abs < 86400000) return rtf.format(hour, "hour");
  if (Math.abs(day) < 30) return rtf.format(day, "day");
  return date.toLocaleDateString(locale);
}

export default function AdminCustomersPage() {
  const dict = useDictionary();
  const { locale } = useLocale();
  const t = dict?.admin?.customers ?? {};
  const tStats = t.stats ?? {};
  const tH = t.headers ?? {};

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    new_this_month: 0,
    returning: 0,
    avg_order_value: 0,
    guests: 0,
    registered: 0,
  });
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const loadCustomers = useCallback(() => {
    return fetch("/api/v1/admin/customers")
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json.data) {
          setCustomers(Array.isArray(json.data.customers) ? json.data.customers : []);
          if (json.data.stats) setStats(json.data.stats);
          setError(null);
        } else {
          setError(json?.error ?? "Failed to load customers");
        }
      })
      .catch(() => setError("Failed to load customers"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadCustomers().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadCustomers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    // Normalise the query as a phone (digits only, last 9) so admins can
    // paste a phone regardless of country-code / formatting differences.
    const qDigits = q.replace(/\D+/g, "");
    const qPhoneTail = qDigits.length >= 4 ? qDigits.slice(-9) : "";
    return customers.filter((c) => {
      const hay = [c.name, c.email, c.phone, c.city, c.country]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (hay.includes(q)) return true;
      if (qPhoneTail) {
        const phoneDigits = String(c.phone ?? "").replace(/\D+/g, "").slice(-9);
        if (phoneDigits && phoneDigits.includes(qPhoneTail)) return true;
      }
      return false;
    });
  }, [customers, search]);

  if (!dict?.admin?.customers || loading) return <AdminCustomersSkeleton />;

  const statCards = [
    { label: tStats.total, value: String(stats.total ?? 0) },
    {
      label: tStats.guests ?? "Guests",
      value: String(stats.guests ?? 0),
      hint: tStats.guests_hint ?? "No account yet",
    },
    { label: tStats.returning, value: String(stats.returning ?? 0) },
    { label: tStats.avg, value: formatCurrency(stats.avg_order_value) },
  ];

  return (
    <>
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">{t.title}</h1>
            {customers.length > 0 && (
              <span className="inline-flex items-center rounded-[3px] bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
                {customers.length}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-1">{t.subtitle}</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center justify-center gap-2 rounded-[3px] bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" />
          {t.add}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            className="rounded-[3px] border border-zinc-100 bg-white p-5"
          >
            <p className="text-sm font-medium text-zinc-500 mb-1">{stat.label}</p>
            <h3 className="text-xl font-bold text-zinc-900">{stat.value}</h3>
            {stat.hint && (
              <p className="text-xs text-zinc-400 mt-0.5">{stat.hint}</p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-[3px] border border-zinc-100 bg-white">
        <div className="flex flex-col gap-4 border-b border-zinc-100 px-4 sm:px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-zinc-900">{t.all}</h2>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search}
                className="w-full sm:w-64 rounded-[3px] border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <button className="flex items-center gap-2 rounded-[3px] border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{dict?.common?.filter}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="border-b border-rose-100 bg-rose-50 px-4 sm:px-6 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* EMPTY STATE */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-[3px] bg-zinc-100 text-zinc-400 mb-3">
              <UsersIcon className="h-6 w-6" />
            </div>
            <p className="font-medium text-zinc-900 mb-1">
              {customers.length === 0
                ? t.empty_title
                : t.no_results_title ?? "No matching customers"}
            </p>
            <p className="text-sm text-zinc-500">
              {customers.length === 0
                ? t.empty_desc
                : t.no_results_desc ?? "Try a different search term."}
            </p>
          </div>
        )}

        {/* MOBILE CARDS */}
        {filtered.length > 0 && (
          <ul className="divide-y divide-zinc-200 sm:hidden">
            {filtered.map((c) => (
              <li
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(c.id);
                  }
                }}
                className="px-4 py-4 flex flex-col gap-3 cursor-pointer hover:bg-zinc-50 focus:outline-none focus:bg-zinc-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-10 w-10 shrink-0 rounded-[3px] flex items-center justify-center font-bold text-xs ${avatarClass(
                        c.name || c.email
                      )}`}
                    >
                      {getInitials(c.name || c.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 text-sm truncate flex items-center gap-1.5">
                        {c.name}
                        {c.kind === "guest" && (
                          <span className="inline-flex items-center gap-1 rounded-[3px] border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            <UserRound className="h-2.5 w-2.5" />
                            {t.guest ?? "Guest"}
                          </span>
                        )}
                        {c.is_banned && (
                          <span className="inline-flex items-center gap-1 rounded-[3px] border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                            <Ban className="h-2.5 w-2.5" />
                            {t.banned ?? "Banned"}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {formatDate(c.joined_at, locale)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedId(c.id);
                    }}
                    className="rounded-[3px] border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors shrink-0"
                  >
                    {dict?.common?.view}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(c.city || c.country) && (
                    <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      <MapPin className="h-3 w-3" />
                      {[c.city, c.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500">
                  <div>
                    <span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">
                      {tH.orders}
                    </span>
                    <span className="text-zinc-900 font-medium">{c.orders}</span>
                  </div>
                  <div>
                    <span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">
                      {tH.spent}
                    </span>
                    <span className="text-zinc-900 font-medium">
                      {formatCurrency(c.spent)}
                    </span>
                  </div>
                  <div>
                    <span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">
                      {t.last_order ?? "Last order"}
                    </span>
                    <span className="text-zinc-900 font-medium">
                      {c.last_order_at
                        ? formatRelative(c.last_order_at, locale)
                        : t.never ?? "—"}
                    </span>
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
                  <th className="px-6 py-3 font-medium">{tH.name}</th>
                  <th className="px-6 py-3 font-medium">{t.location ?? "Location"}</th>
                  <th className="px-6 py-3 font-medium text-center">{tH.orders}</th>
                  <th className="px-6 py-3 font-medium">{tH.spent}</th>
                  <th className="px-6 py-3 font-medium">{tH.joined}</th>
                  <th className="px-6 py-3 font-medium text-right">{tH.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="hover:bg-zinc-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-9 w-9 shrink-0 rounded-[3px] flex items-center justify-center font-bold text-xs ${avatarClass(
                            c.name || c.email
                          )}`}
                        >
                          {getInitials(c.name || c.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 truncate flex items-center gap-1.5">
                            {c.name}
                            {c.kind === "guest" && (
                              <span className="inline-flex items-center gap-1 rounded-[3px] border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                <UserRound className="h-2.5 w-2.5" />
                                {t.guest ?? "Guest"}
                              </span>
                            )}
                            {c.is_banned && (
                              <span className="inline-flex items-center gap-1 rounded-[3px] border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                <Ban className="h-2.5 w-2.5" />
                                {t.banned ?? "Banned"}
                              </span>
                            )}
                          </p>
                          {c.last_order_at ? (
                            <p className="text-xs text-zinc-500 inline-flex items-center gap-1">
                              <ShoppingBag className="h-3 w-3" />
                              {t.last_order ?? "Last order"}{" "}
                              {formatRelative(c.last_order_at, locale)}
                            </p>
                          ) : (
                            <p className="text-xs text-zinc-400">
                              {t.no_orders ?? "No orders yet"}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {c.city || c.country ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-zinc-700">
                          <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                          {[c.city, c.country].filter(Boolean).join(", ")}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center align-top">
                      <span
                        className={`inline-flex items-center justify-center rounded-[3px] px-2.5 py-0.5 text-xs font-semibold ${
                          c.orders > 0
                            ? "bg-zinc-100 text-zinc-800"
                            : "bg-zinc-50 text-zinc-400"
                        }`}
                      >
                        {c.orders}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top font-medium text-zinc-900">
                      {formatCurrency(c.spent)}
                    </td>
                    <td className="px-6 py-4 align-top text-zinc-700">
                      {formatDate(c.joined_at, locale)}
                    </td>
                    <td className="px-6 py-4 text-right align-top">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedId(c.id);
                        }}
                        className="rounded-[3px] border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        {dict?.common?.view}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add customer modal */}
      <AddCustomerModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(id) => {
          loadCustomers().then(() => id && setSelectedId(id));
        }}
      />

      {/* Detail drawer */}
      <CustomerDrawer
        customerId={selectedId}
        isOpen={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        onChanged={() => loadCustomers()}
      />
    </>
  );
}
