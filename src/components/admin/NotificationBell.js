"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Package,
  ShoppingCart,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { isRtlLocale } from "@/config/constants";

const TYPE_META = {
  new_order: {
    icon: ShoppingCart,
    color: "bg-blue-500",
    light: "bg-blue-50 text-blue-700",
  },
  order_cancelled: {
    icon: XCircle,
    color: "bg-red-500",
    light: "bg-red-50 text-red-700",
  },
  low_stock: {
    icon: AlertTriangle,
    color: "bg-amber-500",
    light: "bg-amber-50 text-amber-700",
  },
  out_of_stock: {
    icon: Package,
    color: "bg-zinc-700",
    light: "bg-zinc-100 text-zinc-700",
  },
};

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
    const productId = n.payload?.product_id;
    if (!productId) return null;
    return `/${locale}/admin/products`;
  }
  return null;
}

function NotificationItem({ n, locale, t, onRead, onDelete, closeDropdown, onRequestDelete }) {
  const meta = TYPE_META[n.type] ?? TYPE_META.out_of_stock;
  const Icon = meta.icon;
  const link = getNotificationLink(n, locale);
  const title = t[`type_${n.type}`] ?? n.type;
  const isUnread = !n.read;

  const content = (() => {
    const p = n.payload ?? {};
    if (n.type === "new_order") {
      return t.new_order_desc
        ?.replace("{order}", p.order_number || "#")
        .replace("{customer}", p.customer_name || "Guest")
        .replace("{total}", formatCurrency(p.total, p.currency));
    }
    if (n.type === "order_cancelled") {
      const byKey = p.cancelled_by === 'admin' ? 'cancelled_by_admin' : 'cancelled_by_customer';
      return t.cancelled_desc
        ?.replace("{order}", p.order_number || "#")
        .replace("{by}", t[byKey] ?? p.cancelled_by ?? "");
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

  const body = (
    <div
      className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
        isUnread ? "bg-zinc-50" : "bg-white"
      } hover:bg-zinc-100`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${meta.color}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900">
          {title}
          {isUnread && (
            <span className="ms-1.5 inline-block h-2 w-2 rounded-full bg-blue-600" />
          )}
        </p>
        <p className="mt-0.5 text-xs text-zinc-600 line-clamp-2">{content}</p>
        <p className="mt-1 text-[10px] text-zinc-400">
          {formatRelativeTime(n.created_at, locale)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {isUnread && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRead(n.id);
            }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
            title={t.mark_read}
            aria-label={t.mark_read}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRequestDelete(n.id);
          }}
          className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
          title={t.delete}
          aria-label={t.delete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  if (link) {
    return (
      <Link
        href={link}
        onClick={() => {
          onRead(n.id);
          closeDropdown?.();
        }}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg"
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      onClick={() => {
        onRead(n.id);
        closeDropdown?.();
      }}
      className="cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      {body}
    </div>
  );
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [deleteId, setDeleteId] = useState(null);
  const bellRef = useRef(null);
  const panelRef = useRef(null);
  const { locale } = useParams();
  const router = useRouter();
  const dict = useDictionary();
  const t = dict?.admin?.notifications ?? {};
  const isRtl = isRtlLocale(locale);
  const LIMIT = 20;

  const fetchNotifications = async (reset = false) => {
    const nextOffset = reset ? 0 : offset;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/notifications?limit=${LIMIT}&offset=${nextOffset}`
      );
      const json = await res.json();
      if (json.success) {
        setNotifications((prev) =>
          reset ? json.data : [...prev, ...json.data]
        );
        setUnreadCount(json.unread_count ?? 0);
        setHasMore(json.pagination?.hasMore ?? false);
        setOffset(nextOffset + LIMIT);
      }
    } catch (e) {
      console.error("[NotificationBell] fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!dict) return;
    fetchNotifications(true);
  }, [dict]);

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_notifications",
        },
        (payload) => {
          const n = payload.new;
          if (!n) return;
          setNotifications((prev) => {
            if (prev.some((p) => p.id === n.id)) return prev;
            return [n, ...prev].slice(0, 50);
          });
          setUnreadCount((c) => c + 1);

          const title = t[`type_${n.type}`] ?? n.type;
          const p = n.payload ?? {};
          let message = "";
          if (n.type === "new_order") {
            message = t.new_order_toast
              ?.replace("{order}", p.order_number || "#")
              .replace("{total}", formatCurrency(p.total, p.currency));
          } else if (n.type === "order_cancelled") {
            message = t.cancelled_toast?.replace("{order}", p.order_number || "#");
          } else if (n.type === "low_stock") {
            message = t.low_stock_toast?.replace("{product}", p.product_name || "");
          } else if (n.type === "out_of_stock") {
            message = t.out_of_stock_toast?.replace("{product}", p.product_name || "");
          }

          toast.info(message || title, {
            action: {
              label: t.view ?? "View",
              onClick: () => {
                const link = getNotificationLink(n, locale);
                if (link) router.push(link);
              },
            },
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "admin_notifications",
        },
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
  }, [locale, router, t, notifications]);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;
    const clickHandler = (e) => {
      if (
        bellRef.current?.contains(e.target) ||
        panelRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const keyHandler = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", clickHandler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  const markAsRead = async (id) => {
    try {
      const res = await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read: true }),
      });
      const json = await res.json();
      if (json.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (e) {
      console.error("[NotificationBell] mark as read failed", e);
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
      console.error("[NotificationBell] mark all failed", e);
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
        if (removed && !removed.read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
      }
    } catch (e) {
      console.error("[NotificationBell] delete failed", e);
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
      if (json.success) {
        setNotifications((prev) => prev.filter((n) => !n.read));
      }
    } catch (e) {
      console.error("[NotificationBell] clear read failed", e);
    }
  };

  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        aria-label={t.title ?? "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`absolute top-full z-[110] mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-xl ${
            isRtl ? "left-0" : "right-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-900">
              {t.title ?? "Notifications"}
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                  title={t.mark_all_read ?? "Mark all as read"}
                  aria-label={t.mark_all_read ?? "Mark all as read"}
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              {readNotifications.length > 0 && (
                <button
                  onClick={clearRead}
                  className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
                  title={t.clear_read ?? "Clear read"}
                  aria-label={t.clear_read ?? "Clear read"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-2">
            {notifications.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
                <Bell className="mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm">{t.empty ?? "No notifications yet"}</p>
              </div>
            )}

            {unreadNotifications.length > 0 && (
              <div className="mb-2">
                {unreadNotifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    n={n}
                    locale={locale}
                    t={t}
                    onRead={markAsRead}
                    onDelete={deleteNotification}
                    onRequestDelete={setDeleteId}
                    closeDropdown={() => setOpen(false)}
                  />
                ))}
              </div>
            )}

            {readNotifications.length > 0 && unreadNotifications.length > 0 && (
              <div className="my-2 px-3 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                {t.read ?? "Read"}
              </div>
            )}

            {readNotifications.map((n) => (
              <NotificationItem
                key={n.id}
                n={n}
                locale={locale}
                t={t}
                onRead={markAsRead}
                onDelete={deleteNotification}
                onRequestDelete={setDeleteId}
                closeDropdown={() => setOpen(false)}
              />
            ))}

            {hasMore && (
              <div className="flex justify-center py-2">
                <button
                  onClick={() => fetchNotifications(false)}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    t.load_more ?? "Load more"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={!!deleteId}
        title={t.delete_title ?? "Delete notification?"}
        description={t.delete_desc ?? "This action cannot be undone."}
        confirmText={t.delete ?? "Delete"}
        cancelText={t.cancel ?? "Cancel"}
        onConfirm={() => {
          if (deleteId) {
            deleteNotification(deleteId);
            setDeleteId(null);
          }
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
