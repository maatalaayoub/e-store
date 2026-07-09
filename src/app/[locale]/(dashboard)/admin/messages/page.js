"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDictionary } from "@/components/providers/LocaleProvider";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { toast } from "sonner";
import {
  Mail,
  Trash2,
  Check,
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

  const statusBadge = (status) => {
    const styles = {
      new: "bg-blue-100 text-blue-700",
      read: "bg-zinc-100 text-zinc-600",
      replied: "bg-green-100 text-green-700",
      archived: "bg-zinc-200 text-zinc-500",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
          styles[status] ?? styles.new
        }`}
      >
        {t[`status_${status}`] ?? status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{t.title ?? "Contact Messages"}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {t.subtitle ?? "Messages submitted by visitors through the contact page."}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {t[`filter_${f}`] ?? f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-zinc-100" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-xl border border-zinc-100 bg-white p-12 text-center">
          <Mail className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">{t.empty ?? "No messages yet."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-zinc-100 bg-white p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-zinc-900">{m.name}</h3>
                    {statusBadge(m.status)}
                  </div>
                  <div className="text-xs text-zinc-500 space-y-0.5">
                    <p>
                      <span className="font-medium">{t.email ?? "Email"}:</span>{" "}
                      <a
                        href={`mailto:${m.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {m.email}
                      </a>
                    </p>
                    {m.phone && (
                      <p>
                        <span className="font-medium">{t.phone ?? "Phone"}:</span>{" "}
                        <a href={`tel:${m.phone}`} className="text-blue-600 hover:underline">
                          {m.phone}
                        </a>
                      </p>
                    )}
                    {m.subject && (
                      <p>
                        <span className="font-medium">{t.subject ?? "Subject"}:</span>{" "}
                        {m.subject}
                      </p>
                    )}
                    <p>{formatDate(m.created_at)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {m.status !== "read" && (
                    <button
                      onClick={() => updateStatus(m.id, "read")}
                      title={t.mark_read ?? "Mark as read"}
                      className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  {m.status !== "replied" && (
                    <button
                      onClick={() => updateStatus(m.id, "replied")}
                      title={t.mark_replied ?? "Mark as replied"}
                      className="p-2 rounded-lg text-zinc-500 hover:bg-green-50 hover:text-green-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  )}
                  {m.status !== "archived" && (
                    <button
                      onClick={() => updateStatus(m.id, "archived")}
                      title={t.mark_archived ?? "Archive"}
                      className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                  {m.status !== "new" && (
                    <button
                      onClick={() => updateStatus(m.id, "new")}
                      title={t.mark_new ?? "Mark as new"}
                      className="p-2 rounded-lg text-zinc-500 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteId(m.id)}
                    title={t.delete ?? "Delete"}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <button
                  onClick={() => {
                    if (m.status === "new" && expanded !== m.id) {
                      updateStatus(m.id, "read");
                    }
                    setExpanded(expanded === m.id ? null : m.id);
                  }}
                  className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900"
                >
                  {expanded === m.id ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> {t.message ?? "Message"}
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" /> {t.message ?? "Message"}
                    </>
                  )}
                </button>
                {expanded === m.id && (
                  <div className="mt-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 whitespace-pre-wrap">
                    {m.message}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
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
