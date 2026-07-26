"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  Ban,
  Fingerprint,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  ShoppingBag,
  User as UserIcon,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";

const STATUS_STYLES = {
  pending:    { badge: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmed:  { badge: "bg-blue-50 text-blue-700 border-blue-200" },
  processing: { badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  shipped:    { badge: "bg-purple-50 text-purple-700 border-purple-200" },
  delivered:  { badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled:  { badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

function formatCurrency(amount, currency = "MAD") {
  const v = Number(amount ?? 0);
  return `${Number.isFinite(v) ? v.toFixed(2) : "0.00"} ${currency}`;
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

export default function CustomerDrawer({ customerId, isOpen, onClose, onChanged }) {
  const dict = useDictionary();
  const { locale } = useLocale();
  const t = dict?.admin?.customers ?? {};
  const tD = t.drawer ?? {};

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(false);

  // Ban dialog state
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banDevices, setBanDevices] = useState(true);
  const [banSubmitting, setBanSubmitting] = useState(false);
  const [unbanOpen, setUnbanOpen] = useState(false);
  const [unbanSubmitting, setUnbanSubmitting] = useState(false);

  // Keep the panel mounted during the closing animation.
  useEffect(() => {
    if (isOpen) setSnapshot(true);
    else {
      const id = setTimeout(() => setSnapshot(false), 320);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !customerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/v1/admin/customers/${customerId}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success) setData(json.data);
        else setError(json?.error ?? "Failed to load customer");
      })
      .catch(() => !cancelled && setError("Failed to load customer"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, customerId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !banOpen && !unbanOpen) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, banOpen, unbanOpen, onClose]);

  const submitBan = async () => {
    if (!customerId) return;
    setBanSubmitting(true);
    try {
      const res = await fetch(`/api/v1/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_banned: true,
          include_devices: banDevices,
          reason: banReason.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        toast.error(json?.error ?? tD.ban_error ?? "Failed to ban customer");
        return;
      }
      toast.success(tD.ban_success ?? "Customer banned");
      setBanOpen(false);
      setBanReason("");
      onChanged?.();
      // refresh drawer data
      const refreshed = await fetch(`/api/v1/admin/customers/${customerId}`).then((r) =>
        r.json()
      );
      if (refreshed?.success) setData(refreshed.data);
    } finally {
      setBanSubmitting(false);
    }
  };

  const submitUnban = async () => {
    if (!customerId) return;
    setUnbanSubmitting(true);
    try {
      const res = await fetch(`/api/v1/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_banned: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        toast.error(json?.error ?? tD.unban_error ?? "Failed to unban");
        return;
      }
      toast.success(tD.unban_success ?? "Customer restored");
      setUnbanOpen(false);
      onChanged?.();
      const refreshed = await fetch(`/api/v1/admin/customers/${customerId}`).then((r) =>
        r.json()
      );
      if (refreshed?.success) setData(refreshed.data);
    } finally {
      setUnbanSubmitting(false);
    }
  };

  if (!snapshot || typeof document === "undefined") return null;

  const profile = data?.profile;
  const stats = data?.stats;
  const orders = data?.orders ?? [];
  const devices = data?.devices ?? [];
  const cluster = data?.cluster ?? null;
  const isGuest = profile?.kind === "guest";
  const displayName = profile?.full_name || profile?.email?.split("@")[0] || "—";
  const canBanGuest = isGuest && devices.length > 0;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[10001] bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          fixed z-[10002] bg-white shadow-2xl flex flex-col overflow-hidden transition-transform duration-300
          bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl
          sm:bottom-auto sm:top-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-full sm:max-w-xl sm:rounded-none
          ${isOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"}
        `}
        style={{
          transitionTimingFunction: isOpen
            ? "cubic-bezier(0.32,0.72,0,1)"
            : "cubic-bezier(0.72,0,0.68,1)",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
              {getInitials(displayName)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                {isGuest ? tD.guest_title ?? "Guest customer" : tD.title ?? "Customer"}
              </p>
              <h2 className="text-lg font-bold text-zinc-900 leading-tight truncate">
                {displayName}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {isGuest && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    <UserRound className="h-3 w-3" />
                    {tD.guest_badge ?? "No account"}
                  </span>
                )}
                {profile?.is_banned && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                    <Ban className="h-3 w-3" />
                    {tD.banned ?? "Banned"}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
            aria-label={dict?.common?.close ?? "Close"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-16 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {!loading && error && (
            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && profile && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatTile
                  label={tD.total_orders ?? "Orders"}
                  value={String(stats?.orders ?? 0)}
                />
                <StatTile
                  label={tD.total_spent ?? "Spent"}
                  value={formatCurrency(stats?.spent ?? 0)}
                />
                <StatTile
                  label={tD.joined ?? "Joined"}
                  value={formatDate(profile.created_at, locale)}
                />
              </div>

              {/* Contact */}
              <Section title={tD.contact ?? "Contact"}>
                <InfoRow icon={Mail} value={profile.email || "—"} />
                <InfoRow icon={Phone} value={profile.phone_number || "—"} />
                <InfoRow
                  icon={MapPin}
                  value={
                    [profile.address, profile.city, profile.country]
                      .filter(Boolean)
                      .join(", ") || "—"
                  }
                />
                <InfoRow
                  icon={UserIcon}
                  value={
                    isGuest
                      ? tD.role_guest ?? "Guest checkout"
                      : profile.role === "admin"
                      ? tD.admin ?? "Admin"
                      : tD.client ?? "Customer"
                  }
                />
              </Section>

              {/* Identity signals — only interesting when we merged something */}
              {cluster &&
                (cluster.signals?.length > 1 ||
                  cluster.guest_orders > 0 ||
                  cluster.user_ids?.length > 1) && (
                  <Section title={tD.identity ?? "How we recognised this customer"}>
                    <div className="rounded-[3px] border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-xs text-zinc-700 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <Fingerprint className="h-3.5 w-3.5 text-zinc-400 mt-0.5 shrink-0" />
                        <span>
                          {tD.identity_desc ??
                            "We linked these orders using the following matching signals:"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cluster.signals?.map((s) => (
                          <SignalPill key={s} kind={s} dict={tD} />
                        ))}
                      </div>
                      <p className="text-[11px] text-zinc-500 pt-1">
                        {(tD.identity_orders_summary ?? "Merged {orders} orders ({guest} as guest).")
                          .replace("{orders}", String(orders.length))
                          .replace("{guest}", String(cluster.guest_orders ?? 0))}
                      </p>
                    </div>
                  </Section>
                )}

              {/* Orders */}
              <Section title={`${tD.orders ?? "Purchase history"} (${orders.length})`}>
                {orders.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    {tD.no_orders ?? "This customer has not placed any orders yet."}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {orders.map((o) => {
                      const badge = STATUS_STYLES[o.status]?.badge ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
                      const statusLabel = dict?.admin?.orders?.[`status_${o.status}`] ?? o.status;
                      return (
                        <li
                          key={o.id}
                          className="rounded-[3px] border border-zinc-200 bg-white overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-zinc-100">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-zinc-900">
                                #{o.order_number ?? o.id.slice(0, 8)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {formatDate(o.created_at, locale)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badge}`}
                              >
                                {statusLabel}
                              </span>
                              <span className="text-sm font-semibold text-zinc-900">
                                {formatCurrency(o.total_amount, o.currency_code)}
                              </span>
                            </div>
                          </div>
                          <ul className="divide-y divide-zinc-100">
                            {(o.order_items ?? []).map((it, idx) => (
                              <li
                                key={idx}
                                className="flex items-center gap-3 px-3 py-2"
                              >
                                <div className="h-10 w-10 shrink-0 rounded-md bg-zinc-100 overflow-hidden flex items-center justify-center text-zinc-400">
                                  {it.product_image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={it.product_image}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Package className="h-4 w-4" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-zinc-900 truncate">
                                    {it.product_name}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    {it.quantity} × {formatCurrency(it.unit_price, o.currency_code)}
                                    {it.selected_size ? ` · ${it.selected_size}` : ""}
                                    {it.selected_color?.name
                                      ? ` · ${it.selected_color.name}`
                                      : ""}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>

              {/* Devices */}
              <Section title={`${tD.devices ?? "Known devices"} (${devices.length})`}>
                {devices.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    {tD.no_devices ??
                      "No devices recorded yet. Devices are logged the first time a customer signs in after this update."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {devices.map((d) => (
                      <li
                        key={d.device_id}
                        className="flex items-start justify-between gap-2 rounded-[3px] border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] text-zinc-700 truncate">
                            {d.device_id}
                          </p>
                          <p className="text-zinc-500 truncate">
                            {d.user_agent ?? "—"}
                          </p>
                          <p className="text-zinc-400">
                            {tD.last_seen ?? "Last seen"}: {formatDate(d.last_seen, locale)}
                            {d.ip_address ? ` · ${d.ip_address}` : ""}
                          </p>
                        </div>
                        {d.is_banned && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 shrink-0">
                            <Ban className="h-3 w-3" />
                            {tD.banned ?? "Banned"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {profile.banned_reason && (
                <Section title={tD.ban_reason ?? "Ban reason"}>
                  <p className="rounded-[3px] border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-800 whitespace-pre-wrap">
                    {profile.banned_reason}
                  </p>
                </Section>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {profile && profile.role !== "admin" && (
          <div className="border-t border-zinc-100 px-5 py-3 flex items-center justify-end gap-2">
            {profile.is_banned ? (
              <button
                type="button"
                onClick={() => setUnbanOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <ShieldCheck className="h-4 w-4" />
                {isGuest
                  ? tD.unblock_devices ?? "Unblock devices"
                  : tD.unban ?? "Unban customer"}
              </button>
            ) : isGuest && !canBanGuest ? (
              <span className="text-xs text-zinc-400 italic">
                {tD.guest_no_devices ??
                  "No device recorded yet — cannot block this customer."}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setBanOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                <Ban className="h-4 w-4" />
                {isGuest
                  ? tD.block_devices ?? "Block devices"
                  : tD.ban ?? "Ban customer"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ban dialog */}
      {banOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[10200] flex items-center justify-center bg-black/50 px-4"
            onClick={banSubmitting ? undefined : () => setBanOpen(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
                  <Ban className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-semibold text-zinc-900">
                    {isGuest
                      ? tD.block_title ?? "Block this device?"
                      : tD.ban_title ?? "Ban this customer?"}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {isGuest
                      ? tD.block_desc ??
                        "Any future orders from this browser will be rejected."
                      : tD.ban_desc ??
                        "They will be signed out and cannot place new orders."}
                  </p>
                </div>
              </div>
              <label className="text-sm font-medium text-zinc-700">
                {tD.ban_reason ?? "Reason"}
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  rows={3}
                  placeholder={tD.ban_reason_placeholder ?? "Optional note visible to admins only"}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </label>
              {!isGuest && (
                <label className="flex items-start gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={banDevices}
                    onChange={(e) => setBanDevices(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-600"
                  />
                  <span>
                    {tD.ban_devices ??
                      "Also block every device this customer has ever signed in from"}
                  </span>
                </label>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setBanOpen(false)}
                  disabled={banSubmitting}
                  className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {dict?.common?.cancel ?? "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={submitBan}
                  disabled={banSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-75"
                >
                  {banSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isGuest
                    ? tD.block_devices ?? "Block devices"
                    : tD.ban ?? "Ban customer"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Unban confirm */}
      <ConfirmationDialog
        isOpen={unbanOpen}
        title={
          isGuest
            ? tD.unblock_title ?? "Unblock these devices?"
            : tD.unban_title ?? "Restore this customer?"
        }
        description={
          isGuest
            ? tD.unblock_desc ??
              "Orders from these browsers will be accepted again."
            : tD.unban_desc ??
              "They will be able to sign in again from any device."
        }
        confirmText={
          isGuest
            ? tD.unblock_devices ?? "Unblock"
            : tD.unban ?? "Unban"
        }
        cancelText={dict?.common?.cancel ?? "Cancel"}
        isLoading={unbanSubmitting}
        isDangerous={false}
        onConfirm={submitUnban}
        onCancel={() => setUnbanOpen(false)}
      />
    </>,
    document.body
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p className="text-sm font-bold text-zinc-900 mt-0.5">{value}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, value }) {
  return (
    <div className="flex items-start gap-2 text-sm text-zinc-800">
      <Icon className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
      <span className="break-all">{value}</span>
    </div>
  );
}

const SIGNAL_STYLES = {
  phone:  "bg-emerald-50 text-emerald-800 border-emerald-200",
  email:  "bg-blue-50 text-blue-800 border-blue-200",
  device: "bg-violet-50 text-violet-800 border-violet-200",
};

function SignalPill({ kind, dict }) {
  const label = dict?.[`signal_${kind}`] ?? kind;
  const cls = SIGNAL_STYLES[kind] ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}
