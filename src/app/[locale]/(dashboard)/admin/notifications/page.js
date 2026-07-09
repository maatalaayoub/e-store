"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ShoppingCart,
  XCircle,
  AlertTriangle,
  Package,
  Loader2,
  Filter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminOrdersSkeleton } from "@/components/skeletons";

const TYPE_META = {
  new_order: {
    icon: ShoppingCart,
    color: "bg-blue-500",
    border: "border-blue-200",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  order_cancelled: {
    icon: XCircle,
    color: "bg-red-500",
    border: "border-red-200",
    bg: "bg-red-50",
    text: "text-red-700",
  },
  low_stock: {
    icon: AlertTriangle,
    color: "bg-amber-500",
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  out_of_stock: {
    icon: Package,
    color: "bg-zinc-700",
    border: "border-zinc-200",
    bg: "bg-zinc-100",
    text: "text-zinc-700",
  },
};

const TAB_KEYS = ["all", "unread", "new_order", "order_cancelled", "low_stock", "out_of_stock"];

function formatRelativeTime(dateStr, locale = "en") {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffSec < 60) return rtf.format(-diffSec, "second");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  if (diffDay < 30) return rtf.format(-diffDay, "day");
  return date.toLocaleDateString(locale);
}

function formatCurrency(amount, currency = "MAD") {
  const value = Number(amount ?? 0);
  const formatted = Number.isFinite(value) ? value.toFixed(2) : "0.00";
  return `${formatted} ${currency}`;
}

function getNotificationLink(n, locale) {
  const type = n.type;
  if (type === "new_order" || type === "order_cancelled") {
    const orderId = n.payload?.order_id;
    if (!orderId) return null;
    return `/${locale}/admin/orders?id=${orderId}`;
  }
  if (type === "low_stock" || type === "out_of_stock") {
    return `/${locale}/admin/products`;
  }
  return null;
}

export default function AdminNotificationsPage() {
  const { locale } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dict = useDictionary();
  const t = dict?.admin?.notifications ?? {};
  const tNav = dict?.admin?.nav ?? {};

  const initialTab = searchParams.get("tab") ?? "all";
  const validInitialTab = TAB_KEYS.includes(initialTab) ? initialTab : "all";

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(validInitialTab);
  const [filterType, setFilterType] = useState(
    validInitialTab === "all" || validInitialTab === "unread" ? "all" : validInitialTab
  );
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const LIMIT = 25;

  const fetchNotifications = useCallback(
    async (reset = false, typeFilter = filterType) => {
      const nextOffset = reset ? 0 : offset;
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(LIMIT), offset: String(nextOffset) });
        if (activeTab === "unread") params.set("unread", "true");
        if (typeFilter && typeFilter !== "all" && typeFilter !== "unread") {
          params.set("type", typeFilter);
        }

        const res = await fetch(`/api/v1/notifications?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setNotifications((prev) => (reset ? json.data : [...prev, ...json.data]));
          setUnreadCount(json.unread_count ?? 0);
          setHasMore(json.pagination?.hasMore ?? false);
          setOffset(nextOffset + LIMIT);
        }
      } catch (e) {
        console.error("[AdminNotificationsPage] fetch failed", e);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, filterType, offset]
  );

  useEffect(() => {
    if (!dict) return;
    fetchNotifications(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dict, activeTab]);

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-notifications-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload) => {
          const n = payload.new;
          if (!n) return;
          setNotifications((prev) => {
            if (prev.some((p) => p.id === n.id)) return prev;
            return [n, ...prev];
          });
          setUnreadCount((c) => c + 1);
          toast.info(t[`type_${n.type}`] ?? n.type);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "admin_notifications" },
        (payload) => {
          const n = payload.new;
          if (!n) return;
          setNotifications((prev) =>
            prev.map((item) => (item.id === n.id ? { ...item, read: n.read } : item))
          );
          setUnreadCount((prev) => {
            const current = notifications.filter((x) => !x.read).length;
            const updated = notifications.some((x) => x.id === n.id && !x.read && n.read)
              ? current - 1
              : current;
            return Math.max(0, updated);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [t, notifications]);

  const markAsRead = async (id) => {
    try {
      const res = await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read: true }),
      });
      const json = await res.json();
      if (json.success) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (e) {
      console.error("[AdminNotificationsPage] mark as read failed", e);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, read: true }),
      });
      const json = await res.json();
      if (json.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (e) {
      console.error("[AdminNotificationsPage] mark all failed", e);
    }
  };

  const deleteNotification = async (id) => {
    try {
      const res = await fetch("/api/v1/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const json = await res.json();
      if (json.success) {
        const removed = notifications.find((n) => n.id === id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (removed && !removed.read) setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (e) {
      console.error("[AdminNotificationsPage] delete failed", e);
    }
  };

  const clearRead = async () => {
    try {
      const res = await fetch("/api/v1/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all_read: true }),
      });
      const json = await res.json();
      if (json.success) setNotifications((prev) => prev.filter((n) => !n.read));
    } catch (e) {
      console.error("[AdminNotificationsPage] clear read failed", e);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFilterType(tab === "all" || tab === "unread" ? "all" : tab);
    setOffset(0);
  };

  const filtered = notifications;

  if (!dict?.admin?.notifications) return <AdminOrdersSkeleton />;

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{tNav.notifications ?? t.title ?? "Notifications"}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {unreadCount > 0
              ? `${unreadCount} ${t.unread ?? "unread"}`
              : t.empty ?? "No notifications"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <CheckCheck className="h-4 w-4" />
              {t.mark_all_read ?? "Mark all read"}
            </button>
          )}
          {notifications.some((n) => n.read) && (
            <button
              onClick={clearRead}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              {t.clear_read ?? "Clear read"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TAB_KEYS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {tab === "all"
              ? t.filter_all ?? "All"
              : tab === "unread"
              ? t.filter_unread ?? "Unread"
              : t[`type_${tab}`] ?? tab}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-xl border border-zinc-100 bg-white">
        {filtered.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <Bell className="mb-3 h-12 w-12 opacity-40" />
            <p className="text-sm">{t.empty ?? "No notifications yet"}</p>
          </div>
        )}

        <ul className="divide-y divide-zinc-100">
          {filtered.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.out_of_stock;
            const Icon = meta.icon;
            const link = getNotificationLink(n, locale);
            const title = t[`type_${n.type}`] ?? n.type;
            const isUnread = !n.read;
            const p = n.payload ?? {};

            const description = (() => {
              if (n.type === "new_order") {
                return t.new_order_desc
                  ?.replace("{order}", p.order_number || "#")
                  .replace("{customer}", p.customer_name || "Guest")
                  .replace("{total}", formatCurrency(p.total, p.currency));
              }
              if (n.type === "order_cancelled") {
                const byKey = p.cancelled_by === 'admin' ? 'cancelled_by_admin' : 'cancelled_by_customer';
                return t.cancelled_desc?.replace("{order}", p.order_number || "#").replace("{by}", t[byKey] ?? p.cancelled_by ?? "");
              }
              if (n.type === "low_stock") {
                return t.low_stock_desc
                  ?.replace("{product}", p.product_name || "")
                  .replace("{stock}", p.stock ?? 0);
              }
              if (n.type === "out_of_stock") {
                return t.out_of_stock_desc?.replace("{product}", p.product_name || "");
              }
              return "";
            })();

            const content = (
              <div
                className={`flex items-start gap-4 p-4 transition-colors hover:bg-zinc-50 ${
                  isUnread ? "bg-zinc-50/80" : "bg-white"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${meta.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {title}
                        {isUnread && (
                          <span className="ms-2 inline-block h-2 w-2 rounded-full bg-blue-600" />
                        )}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">{description}</p>
                      <p className="mt-1 text-xs text-zinc-400">{formatRelativeTime(n.created_at, locale)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {isUnread && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markAsRead(n.id);
                          }}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                          title={t.mark_read}
                          aria-label={t.mark_read}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        title={t.delete}
                        aria-label={t.delete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );

            return (
              <li key={n.id}>
                {link ? (
                  <Link
                    href={link}
                    onClick={() => markAsRead(n.id)}
                    className="block outline-none focus-visible:bg-zinc-100"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>

        {hasMore && (
          <div className="flex justify-center border-t border-zinc-100 py-4">
            <button
              onClick={() => fetchNotifications(false)}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.load_more ?? "Load more"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
