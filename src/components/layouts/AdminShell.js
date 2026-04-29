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

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";

const NAV_ITEMS = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", key: "products", icon: Package },
  { href: "/admin/orders", key: "orders", icon: ShoppingCart },
  { href: "/admin/customers", key: "customers", icon: Users },
  { href: "/admin/settings", key: "settings", icon: Settings },
];

export default function AdminShell({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { locale } = useParams();
  const dict = useDictionary();
  const tNav = dict?.admin?.nav ?? {};

  const withLocale = (href) => `/${locale}${href}`;

  const isActive = (item) => {
    const target = withLocale(item.href);
    return item.exact ? pathname === target : pathname.startsWith(target);
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* MOBILE SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-[100] w-64 border-r border-zinc-100 bg-white transition-all duration-300 lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-[100%]"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-6">
          <Link
            href={withLocale("/admin")}
            className="flex items-center gap-2 font-bold tracking-tighter text-blue-600 text-xl"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white text-xs">
              E
            </div>
            <span className="text-zinc-900">ADMIN.</span>
          </Link>
          <button
            className="lg:hidden text-zinc-500"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={withLocale(item.href)}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-600"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <Icon className="h-5 w-5" />
                {tNav[item.key] ?? item.key}
              </Link>
            );
          })}
        </nav>

        <div className="absolute w-full bottom-0 border-t border-zinc-200 p-4">
          <Link
            href={withLocale("/")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          >
            <LogOut className="h-5 w-5" />
            {tNav.exit}
          </Link>
        </div>
      </aside>

      {/* MAIN COLUMN */}
      <main className="flex-1 flex flex-col w-0 min-w-0 bg-white">
        {/* HEADER */}
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-zinc-100 bg-white px-4 sm:px-6 md:px-8">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-zinc-500 hover:text-zinc-900"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:flex relative items-center">
              <Search className="absolute left-3 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder={dict?.admin?.search_placeholder ?? "Search..."}
                className="w-64 rounded-full bg-zinc-50 pl-10 pr-4 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="relative p-2 text-zinc-500 hover:text-zinc-900"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              A
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 sm:p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
