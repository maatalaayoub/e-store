"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDictionary } from "@/components/providers/LocaleProvider";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { toast } from "sonner";
import {
  Mail,
  Trash2,
  Archive,
  RotateCcw,
  MessageCircle,
  Eye,
  EyeOff,
} from "lucide-react";

const STATUS_FILTERS = ["all", "new", "read", "replied", "archived"];

export default function AdminMessagesPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "all";
  const dict = useDictionary();
  const t = dict?.admin?.settings?.messages ?? {};
  const [messages, setMessages] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(
    STATUS_FILTERS.includes(initialStatus) ? initialStatus : "all"
  );
  const [expanded, setExpanded] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const url =
        filter === "all"
          ? "/api/v1/admin/contact-messages"
          : `/api/v1/admin/contact-messages?status=${filter}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setMessages(json.data ?? []);
        setCount(json.count ?? 0);
      } else {
        throw new Error(json.error ?? "Failed");
      }
    } catch (err) {
      toast.error(t.error ?? "Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!dict) return;
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dict, filter]);

  const updateStatus = async (id, status) => {
    try {
      const res = await fetch("/api/v1/admin/contact-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed");
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status } : m))
      );
    } catch (err) {
      toast.error(err?.message ?? "Failed to update");
    }
  };

  const deleteMessage = async (id) => {
    try {
      const res = await fetch(`/api/v1/admin/contact-messages?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed");
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setCount((c) => Math.max(0, c - 1));
      toast.success("Deleted");
    } catch (err) {
      toast.error(err?.message ?? "Failed to delete");
    } finally {
      setDeleteId(null);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString(dict?.locale ?? "en", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // Colored accent + badge palette keyed by status so the whole card reads
  // at a glance without relying on a shadow.
  const STATUS_STYLES = {
    new:      { accent: "bg-blue-500",   badge: "bg-blue-50 text-blue-700 border border-blue-200",      dot: "bg-blue-500" },
    read:     { accent: "bg-zinc-300",   badge: "bg-zinc-100 text-zinc-600 border border-zinc-200",     dot: "bg-zinc-400" },
    replied:  { accent: "bg-emerald-500",badge: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
    archived: { accent: "bg-zinc-400",   badge: "bg-zinc-100 text-zinc-500 border border-zinc-200",     dot: "bg-zinc-400" },
  };

  const statusBadge = (status) => {
    const s = STATUS_STYLES[status] ?? STATUS_STYLES.new;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        {t[`status_${status}`] ?? status}
      </span>
    );
  };

  // Compact colored avatar showing the sender's initial. Deterministic hue
  // per name so the same sender always gets the same color.
  const getInitials = (name = "") =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";

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
  const avatarClass = (seed = "") => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">{t.title ?? "Contact Messages"}</h1>
            {count > 0 && (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
                {count}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            {t.subtitle ?? "Messages submitted by visitors through the contact page."}
          </p>
        </div>
      </div>

      {/* ── Filter pills (same style as storefront tabs) ── */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Message filters">
        {STATUS_FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 border ${
                active
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/25"
                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {t[`filter_${f}`] ?? f}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-[3px] bg-zinc-100" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-[3px] border border-zinc-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
            <Mail className="h-6 w-6 text-zinc-400" />
          </div>
          <p className="text-sm text-zinc-500">{t.empty ?? "No messages yet."}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => {
            const s = STATUS_STYLES[m.status] ?? STATUS_STYLES.new;
            const isOpen = expanded === m.id;
            return (
              <li
                key={m.id}
                className="relative overflow-hidden rounded-[3px] border border-zinc-200 bg-white transition-colors hover:border-zinc-300"
              >
                {/* Status accent strip on the leading edge */}
                <span aria-hidden="true" className={`absolute inset-y-0 start-0 w-1 ${s.accent}`} />

                <div className="p-4 sm:p-5 ps-5 sm:ps-6">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div
                      className={`hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass(m.name || m.email)}`}
                      aria-hidden="true"
                    >
                      {getInitials(m.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Top row: name + status + timestamp */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="text-sm font-semibold text-zinc-900 truncate">{m.name}</h3>
                        {statusBadge(m.status)}
                        <span className="ms-auto text-xs text-zinc-400 whitespace-nowrap">
                          {formatDate(m.created_at)}
                        </span>
                      </div>

                      {/* Contact chips */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <a
                          href={`mailto:${m.email}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                        >
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[16rem]">{m.email}</span>
                        </a>
                        {m.phone && (
                          <a
                            href={`tel:${m.phone}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                          >
                            {m.phone}
                          </a>
                        )}
                      </div>

                      {/* Subject */}
                      {m.subject && (
                        <p className="mt-2 text-sm text-zinc-700 line-clamp-1">
                          <span className="font-medium">{m.subject}</span>
                        </p>
                      )}

                      {/* Expandable message */}
                      <div className="mt-3">
                        <button
                          onClick={() => {
                            if (m.status === "new" && !isOpen) {
                              updateStatus(m.id, "read");
                            }
                            setExpanded(isOpen ? null : m.id);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" /> {t.hide ?? "Hide message"}
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" /> {t.message ?? "Message"}
                            </>
                          )}
                        </button>
                        {isOpen && (
                          <div className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-700 whitespace-pre-wrap">
                            {m.message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-end gap-1">
                    {m.status !== "read" && (
                      <button
                        onClick={() => updateStatus(m.id, "read")}
                        title={t.mark_read ?? "Mark as read"}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t.mark_read ?? "Read"}</span>
                      </button>
                    )}
                    {m.status !== "replied" && (
                      <button
                        onClick={() => updateStatus(m.id, "replied")}
                        title={t.mark_replied ?? "Mark as replied"}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t.mark_replied ?? "Replied"}</span>
                      </button>
                    )}
                    {m.status !== "archived" && (
                      <button
                        onClick={() => updateStatus(m.id, "archived")}
                        title={t.mark_archived ?? "Archive"}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t.mark_archived ?? "Archive"}</span>
                      </button>
                    )}
                    {m.status !== "new" && (
                      <button
                        onClick={() => updateStatus(m.id, "new")}
                        title={t.mark_new ?? "Mark as new"}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t.mark_new ?? "New"}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteId(m.id)}
                      title={t.delete ?? "Delete"}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{t.delete ?? "Delete"}</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmationDialog
        isOpen={deleteId !== null}
        title={t.delete_title ?? "Delete message?"}
        description={t.delete_desc ?? "This action cannot be undone."}
        confirmText={t.delete ?? "Delete"}
        cancelText={dict?.common?.close ?? "Cancel"}
        icon={<Trash2 className="h-5 w-5" />}
        onConfirm={() => deleteMessage(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
