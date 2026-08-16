"use client";

/**
 * AdminShell
 *
 * Persistent sidebar + top-bar shell for all /admin/* pages.
 * Highlights the active nav item based on the current pathname and
 * prefixes every link with the active locale segment.
 *
 * @param {{ children: React.ReactNode }} props
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UserCog,
  Settings,
  Menu,
  X,
  LogOut,
  Mail,
  Bell,
  Tag,
} from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminOrderViewProvider } from "@/components/providers/AdminOrderViewContext";
import AdminSearch from "@/components/layouts/AdminSearch";
import NotificationBell from "@/components/admin/NotificationBell";
import { isRtlLocale } from "@/config/constants";
import { createClient } from "@/lib/supabase/client";
import { guardNavigation } from "@/lib/nav-guard";

const NAV_ITEMS = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboard, exact: true, permission: "dashboard" },
  { href: "/admin/products", key: "products", icon: Package, permission: "products" },
  { href: "/admin/orders", key: "orders", icon: ShoppingCart, permission: "orders" },
  { href: "/admin/customers", key: "customers", icon: Users, permission: "customers" },
  { href: "/admin/messages", key: "messages", icon: Mail, permission: "messages" },
  { href: "/admin/notifications", key: "notifications", icon: Bell, permission: "notifications" },
  { href: "/admin/marketing", key: "marketing", icon: Tag, permission: "products" },
  { href: "/admin/team", key: "team", icon: UserCog, ownerOnly: true },
  { href: "/admin/settings", key: "settings", icon: Settings, permission: "settings" },
];

export default function AdminShell({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useParams();
  const dict = useDictionary();
  const tNav = dict?.admin?.nav ?? {};
  const isRtl = isRtlLocale(locale);
  const logoutIconDirectionClass = isRtl ? "" : "-scale-x-100";
  const [logoUrl, setLogoUrl] = useState("");
  const [logoSize, setLogoSize] = useState({ width: 160, height: 40 });
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // Access context drives which nav items a staff member can see. `null`
  // while loading; owners get everything, staff only their permissions.
  const [access, setAccess] = useState(null);

  // Resolve the signed-in user's role + permissions so we can filter the nav.
  useEffect(() => {
    fetch("/api/v1/team/me")
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) {
          setAccess({
            role: json.role,
            permissions: Array.isArray(json.permissions) ? json.permissions : [],
            isOwner: !!json.isOwner,
          });
        }
      })
      .catch(() => {});
  }, []);

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    // Until access resolves, owners' full nav is a safe default; staff nav is
    // corrected as soon as the fetch returns.
    if (!access) return !item.ownerOnly;
    if (access.isOwner) return true;
    if (item.ownerOnly) return false;
    return item.permission ? access.permissions.includes(item.permission) : false;
  });

  // Staff without the 'dashboard' permission should never sit on the empty
  // Overview page — send them to their first authorized page instead.
  useEffect(() => {
    if (!access || access.isOwner) return;
    const onOverview = pathname === `/${locale}/admin`;
    const canSeeDashboard = access.permissions.includes("dashboard");
    if (onOverview && !canSeeDashboard) {
      const first = NAV_ITEMS.find(
        (item) => !item.ownerOnly && item.permission && access.permissions.includes(item.permission)
      );
      if (first) router.replace(`/${locale}${first.href}`);
    }
  }, [access, pathname, locale, router]);

  useEffect(() => {
    fetch("/api/v1/display-settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          if (json.data.store_logo) setLogoUrl(json.data.store_logo);
          setLogoSize({
            width: Math.min(Math.max(parseInt(json.data.store_logo_size || '160', 10) || 160, 80), 320),
            height: Math.min(Math.max(parseInt(json.data.store_logo_height || '40', 10) || 40, 20), 120),
          });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch initial unread counts for messages and notifications.
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [messagesRes, notificationsRes] = await Promise.all([
          fetch("/api/v1/admin/contact-messages?status=new&limit=1"),
          fetch("/api/v1/notifications?unread=true&limit=1"),
        ]);
        const messagesJson = await messagesRes.json();
        const notificationsJson = await notificationsRes.json();
        if (messagesJson.success) setUnreadMessages(messagesJson.unread_count ?? 0);
        if (notificationsJson.success) setUnreadNotifications(notificationsJson.unread_count ?? 0);
      } catch (e) {
        console.error("[AdminShell] failed to fetch unread counts", e);
      }
    };
    fetchCounts();
  }, []);

  // Real-time updates for unread counts.
  useEffect(() => {
    const supabase = createClient();

    const notificationsChannel = supabase
      .channel("admin-shell-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload) => {
          const n = payload.new;
          if (n && !n.read) setUnreadNotifications((c) => c + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "admin_notifications" },
        (payload) => {
          const oldRead = payload.old?.read ?? true;
          const newRead = payload.new?.read ?? true;
          if (oldRead === newRead) return;
          setUnreadNotifications((c) => Math.max(0, newRead ? c - 1 : c + 1));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "admin_notifications" },
        (payload) => {
          const wasUnread = payload.old?.read === false;
          if (wasUnread) setUnreadNotifications((c) => Math.max(0, c - 1));
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel("admin-shell-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contact_messages" },
        (payload) => {
          const m = payload.new;
          if (m && m.status === "new") setUnreadMessages((c) => c + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contact_messages" },
        (payload) => {
          const oldNew = payload.old?.status === "new";
          const newNew = payload.new?.status === "new";
          if (oldNew === newNew) return;
          setUnreadMessages((c) => Math.max(0, newNew ? c + 1 : c - 1));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "contact_messages" },
        (payload) => {
          const wasNew = payload.old?.status === "new";
          if (wasNew) setUnreadMessages((c) => Math.max(0, c - 1));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, []);

  const withLocale = (href) => `/${locale}${href}`;

  const isActive = (item) => {
    const target = withLocale(item.href);
    return item.exact ? pathname === target : pathname.startsWith(target);
  };

  return (
    <AdminOrderViewProvider>
      <div className="fixed inset-0 flex bg-white overflow-hidden">
      {/* MOBILE SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 z-[100] w-64 border-e border-zinc-100 bg-white transition-all duration-300 lg:static lg:translate-x-0 scrollbar-hide ${
          isRtl ? "right-0" : "left-0"
        } ${
          isSidebarOpen ? "translate-x-0" : isRtl ? "translate-x-[100%]" : "-translate-x-[100%]"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-6">
          {logoUrl ? (
            <Link
              href={withLocale("/admin")}
              onClick={(e) => {
                const target = withLocale("/admin");
                if (guardNavigation(() => router.push(target))) {
                  e.preventDefault();
                }
              }}
              className="flex items-center"
            >
              <Image
                src={logoUrl}
                alt="LaCérémonie"
                width={logoSize.width}
                height={logoSize.height}
                className="h-auto w-auto max-w-full object-contain"
                style={{ maxHeight: `${logoSize.height}px` }}
                priority
              />
            </Link>
          ) : (
            <div className="h-5 w-32" />
          )}
          <button
            className="lg:hidden text-zinc-500"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            const badgeCount =
              item.key === "messages"
                ? unreadMessages
                : item.key === "notifications"
                ? unreadNotifications
                : 0;
            const showBadge = badgeCount > 0;
            return (
              <Link
                key={item.href}
                href={withLocale(item.href)}
                onClick={(e) => {
                  setIsSidebarOpen(false);
                  const target = withLocale(item.href);
                  if (guardNavigation(() => router.push(target))) {
                    e.preventDefault();
                  }
                }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
                style={active ? { backgroundColor: "#1447E620", color: "#1447E6" } : {}}
              >
                <span className="relative inline-flex">
                  <Icon className="h-5 w-5" />
                  {showBadge && (
                    <span
                      className="absolute -top-1.5 -end-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 ring-2 ring-white text-white text-[10px] font-bold flex items-center justify-center leading-none"
                      aria-hidden="true"
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </span>
                {tNav[item.key] ?? item.key}
              </Link>
            );
          })}
        </nav>

        <div className="absolute w-full bottom-0 border-t border-zinc-200 p-4">
          <Link
            href={withLocale("/")}
            onClick={(e) => {
              const target = withLocale("/");
              if (guardNavigation(() => router.push(target))) {
                e.preventDefault();
              }
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          >
            <LogOut className={`h-5 w-5 ${logoutIconDirectionClass}`} />
            {tNav.exit}
          </Link>
        </div>
      </aside>

      {/* MAIN COLUMN */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col w-0 min-w-0 bg-white">
        {/* HEADER */}
        <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white px-4 sm:px-6 md:px-8">
          {/* Main row */}
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden text-zinc-500 hover:text-zinc-900"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="hidden sm:flex relative items-center">
                <AdminSearch locale={locale} isRtl={isRtl} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
            </div>
          </div>
          {/* Mobile search row — only visible below sm */}
          <div className="sm:hidden pb-3">
            <AdminSearch locale={locale} isRtl={isRtl} />
          </div>
        </header>

        <div data-scroll-main className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-4 sm:p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
    </AdminOrderViewProvider>
  );
}
