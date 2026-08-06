"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  Crown,
  LayoutDashboard,
  Mail,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  UserCog,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import InviteMemberModal from "./_components/InviteMemberModal";

const PERMISSION_ICONS = {
  dashboard: LayoutDashboard,
  products: Package,
  orders: ShoppingCart,
  customers: UsersIcon,
  messages: Mail,
  notifications: Bell,
  settings: Settings,
};

const AVATAR_PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
];

function getInitials(name = "", email = "") {
  const base = (name || email || "?").trim();
  return (
    base
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

function TeamPageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded bg-zinc-200" />
          <div className="h-3 w-64 rounded bg-zinc-200" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-zinc-200" />
      </div>
      <div className="mb-6 h-24 rounded-xl bg-zinc-100" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}

export default function AdminTeamPage() {
  const dict = useDictionary();
  const { locale } = useLocale();
  const t = dict?.admin?.team ?? {};
  const tp = t.permissions_labels ?? {};

  const [loading, setLoading] = useState(true);
  const [owners, setOwners] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return fetch("/api/v1/admin/team")
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json.data) {
          setOwners(Array.isArray(json.data.owners) ? json.data.owners : []);
          setMembers(Array.isArray(json.data.members) ? json.data.members : []);
          setError(null);
        } else {
          setError(json?.error ?? "Failed to load team");
        }
      })
      .catch(() => setError("Failed to load team"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = useCallback(() => {
    load();
  }, [load]);

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(
        `/api/v1/admin/team?user_id=${encodeURIComponent(removeTarget.id)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      toast.success(t.toast_removed ?? "Team member removed");
      setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id));
      setRemoveTarget(null);
    } catch {
      toast.error(t.toast_remove_failed ?? "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  };

  const openEdit = (member) => {
    setEditMember(member);
    setInviteOpen(true);
  };

  const openInvite = () => {
    setEditMember(null);
    setInviteOpen(true);
  };

  const totalPeople = useMemo(() => owners.length + members.length, [owners, members]);

  if (!dict?.admin?.team || loading) return <TeamPageSkeleton />;

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">{t.title ?? "Team"}</h1>
            {totalPeople > 0 && (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
                {totalPeople}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {t.subtitle ?? "Invite people to help manage your store and control what they can access."}
          </p>
        </div>
        <button
          onClick={openInvite}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" />
          {t.invite_button ?? "Invite member"}
        </button>
      </div>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      {/* Owners */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          <Crown className="h-4 w-4 text-amber-500" />
          {t.owners_heading ?? "Owners"}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {owners.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white p-4"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass(
                  o.email ?? o.id
                )}`}
              >
                {getInitials(o.full_name, o.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {o.full_name || (t.no_name ?? "Unnamed")}
                </p>
                <p className="truncate text-xs text-zinc-500">{o.email}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t.owner_badge ?? "Full access"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Members */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          <UserCog className="h-4 w-4 text-zinc-400" />
          {t.members_heading ?? "Team members"}
        </h2>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <UsersIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium text-zinc-700">
              {t.empty_title ?? "No team members yet"}
            </p>
            <p className="mt-1 max-w-sm text-xs text-zinc-500">
              {t.empty_desc ?? "Invite an existing account by email or account ID to give them access to your store."}
            </p>
            <button
              onClick={openInvite}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <UserPlus className="h-4 w-4" />
              {t.invite_button ?? "Invite member"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-4 rounded-xl border border-zinc-100 bg-white p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass(
                      m.email ?? m.id
                    )}`}
                  >
                    {getInitials(m.full_name, m.email)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {m.full_name || (t.no_name ?? "Unnamed")}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{m.email}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {t.added_on ?? "Added"} {formatDate(m.team_added_at, locale)}
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-zinc-400">
                      <CalendarClock className="h-3 w-3" />
                      {(() => {
                        const from = m.data_from ? formatDate(m.data_from, locale) : null;
                        const to   = m.data_to   ? formatDate(m.data_to,   locale) : null;
                        if (from && to) {
                          const tpl = t.date_range_between ?? "Data from {from} to {to}";
                          return tpl.replace("{from}", from).replace("{to}", to);
                        }
                        if (from) return `${t.date_range_since ?? t.data_from_since ?? "Data since"} ${from}`;
                        if (to)   return `${t.date_range_until ?? "Data until"} ${to}`;
                        return t.date_range_all ?? t.data_from_all ?? "All-time data";
                      })()}
                    </p>
                  </div>
                </div>

                {/* Permission chips */}
                <div className="flex flex-wrap gap-1.5 sm:max-w-md sm:justify-end">
                  {(m.permissions ?? []).map((p) => {
                    const Icon = PERMISSION_ICONS[p] ?? ShieldCheck;
                    return (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
                      >
                        <Icon className="h-3 w-3" />
                        {tp[p] ?? p}
                      </span>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 sm:shrink-0">
                  <button
                    onClick={() => openEdit(m)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t.edit_button ?? "Permissions"}
                  </button>
                  <button
                    onClick={() => setRemoveTarget(m)}
                    className="inline-flex items-center justify-center rounded-lg border border-zinc-200 p-1.5 text-zinc-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    aria-label={t.remove_button ?? "Remove"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <InviteMemberModal
        isOpen={inviteOpen}
        member={editMember}
        onClose={() => setInviteOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmationDialog
        isOpen={!!removeTarget}
        title={t.remove_title ?? "Remove team member?"}
        description={
          removeTarget
            ? (t.remove_desc ?? "{name} will lose all access to your store admin.").replace(
                "{name}",
                removeTarget.full_name || removeTarget.email
              )
            : ""
        }
        confirmText={t.remove_confirm ?? "Remove"}
        cancelText={t.cancel ?? "Cancel"}
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
        isLoading={removing}
        isDangerous
      />
    </>
  );
}
