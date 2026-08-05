"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  Bell,
  CalendarClock,
  Check,
  LayoutDashboard,
  Loader2,
  Mail,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";

const PERMISSION_ICONS = {
  dashboard: LayoutDashboard,
  products: Package,
  orders: ShoppingCart,
  customers: Users,
  messages: Mail,
  notifications: Bell,
  settings: Settings,
};

const PERMISSION_KEYS = ["dashboard", "products", "orders", "customers", "messages", "notifications", "settings"];

/**
 * Invite a new team member or edit an existing member's permissions.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {(member: object) => void} props.onSaved
 * @param {object|null} [props.member]  When set, the modal edits this member.
 */
export default function InviteMemberModal({ isOpen, onClose, onSaved, member }) {
  const dict = useDictionary();
  const t = dict?.admin?.team ?? {};
  const tp = t.permissions_labels ?? {};
  const tErr = t.errors ?? {};
  const isEdit = !!member;

  const [identifier, setIdentifier] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [dataFrom, setDataFrom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) setMounted(true);
    else {
      const id = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setIdentifier("");
    setPermissions(isEdit ? [...(member.permissions ?? [])] : []);
    setDataFrom(isEdit ? (member.data_from ?? "") : "");
    setError(null);
    setSubmitting(false);
  }, [isOpen, isEdit, member]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, submitting, onClose]);

  const togglePermission = (key) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const mapError = (code) => tErr[code] ?? tErr.generic ?? "Something went wrong. Please try again.";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isEdit && !identifier.trim()) {
      setError(tErr.identifier_required ?? "Enter an account email or ID.");
      return;
    }
    if (permissions.length === 0) {
      setError(tErr.permissions_required ?? "Select at least one permission.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/team", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { user_id: member.id, permissions, data_from: dataFrom || null }
            : { identifier: identifier.trim(), permissions, data_from: dataFrom || null }
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = mapError(json.error);
        setError(msg);
        return;
      }
      toast.success(isEdit ? t.toast_updated ?? "Permissions updated" : t.toast_invited ?? "Team member added");
      onSaved?.(json.data);
      onClose?.();
    } catch {
      setError(tErr.generic ?? "Something went wrong. Please try again.");
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
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !submitting && onClose?.()}
      />
      <div
        className={`relative w-full max-w-lg rounded-[5px] bg-white shadow-xl transition-transform ${
          isOpen ? "translate-y-0" : "translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[5px] bg-blue-50 text-blue-600">
              {isEdit ? <ShieldCheck className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                {isEdit ? t.edit_title ?? "Edit permissions" : t.invite_title ?? "Invite team member"}
              </h2>
              <p className="text-xs text-zinc-500">
                {isEdit
                  ? member.email
                  : t.invite_subtitle ?? "Invite an existing account to help manage your store."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose?.()}
            className="text-zinc-400 hover:text-zinc-700"
            aria-label={t.close ?? "Close"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {!isEdit && (
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                {t.identifier_label ?? "Account email or ID"}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t.identifier_placeholder ?? "name@example.com or account ID"}
                className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoFocus
                dir="ltr"
              />
              <p className="mt-1.5 text-xs text-zinc-500">
                {t.identifier_hint ?? "The person must already have an account on your store."}
              </p>
            </div>
          )}

          <div className="mb-2">
            <p className="text-sm font-medium text-zinc-700">{t.permissions_label ?? "Permissions"}</p>
            <p className="text-xs text-zinc-500">
              {t.permissions_hint ?? "Choose which areas this member can manage."}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PERMISSION_KEYS.map((key) => {
              const Icon = PERMISSION_ICONS[key];
              const checked = permissions.includes(key);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => togglePermission(key)}
                  className={`flex items-center gap-3 rounded-[5px] border px-3 py-2.5 text-start transition-colors ${
                    checked
                      ? "border-blue-500 bg-blue-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-[5px] ${
                      checked ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-zinc-800">
                    {tp[key] ?? key}
                  </span>
                  {checked && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              );
            })}
          </div>

          <div className="mt-5 border-t border-zinc-100 pt-5">
            <div className="mb-2 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-zinc-500" />
              <p className="text-sm font-medium text-zinc-700">
                {t.data_from_label ?? "Data visibility"}
              </p>
            </div>
            <p className="mb-2 text-xs text-zinc-500">
              {t.data_from_hint ??
                "Limit this member to store data (orders, stats) created on or after this date. Leave empty for all-time access."}
            </p>
            <input
              type="date"
              value={dataFrom}
              onChange={(e) => setDataFrom(e.target.value)}
              className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-auto"
              dir="ltr"
            />
            {dataFrom && (
              <button
                type="button"
                onClick={() => setDataFrom("")}
                className="ms-3 text-xs font-medium text-blue-600 hover:underline"
              >
                {t.data_from_clear ?? "Clear (all-time)"}
              </button>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-[5px] bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => !submitting && onClose?.()}
              className="rounded-[5px] px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              {t.cancel ?? "Cancel"}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-[5px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? t.save ?? "Save changes" : t.send_invite ?? "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
