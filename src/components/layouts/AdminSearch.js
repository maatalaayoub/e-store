"use client";

/**
 * AdminSearch
 *
 * Command-palette-style search bar for the admin shell.
 *
 * Features:
 *   • Localized index built from the active dictionary (en/fr/ar/dr).
 *   • Accent/diacritic-insensitive substring matching (works for FR é/è and AR
 *     vowel marks).
 *   • Keyboard navigation: ↑/↓ to move, Enter to open, Esc to close.
 *   • Cmd/Ctrl + K shortcut to focus the input from anywhere.
 *   • Click-outside and route-change auto-close.
 *   • Results grouped by category with icons and a context-aware empty state.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Store,
  Layers,
  Megaphone,
  CreditCard,
  Truck,
  Bell,
  Zap,
  Globe,
  Plus,
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";

/** Strip diacritics + lowercase for forgiving substring matching. */
function normalize(s) {
  if (!s) return "";
  return String(s)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Build the searchable index from the active dictionary so labels are always in
 * the user's language. Each entry contains the localized label, an optional
 * description, the destination href, an icon, and a list of search keywords
 * (also localized, plus a few stable English aliases so power users can type
 * "products" even on a French UI).
 */
function buildIndex({ dict, locale, t }) {
  const nav = dict?.admin?.nav ?? {};
  const sec = dict?.admin?.settings?.sections ?? {};
  const dash = dict?.admin?.dashboard ?? {};
  const prod = dict?.admin?.products ?? {};
  const ann = dict?.admin?.settings?.announcements ?? {};
  const settingsTitle = dict?.admin?.settings?.title ?? "Settings";

  const groupPages = t.group_pages ?? "Pages";
  const groupSettings = t.group_settings ?? settingsTitle;
  const groupActions = t.group_actions ?? "Quick Actions";

  const wl = (href) => `/${locale}${href}`;

  return [
    // Top-level pages
    { id: "page-dashboard",  group: groupPages,    icon: LayoutDashboard, label: nav.dashboard ?? "Dashboard",  href: wl("/admin"),                  keywords: ["dashboard", "home", "overview", dash.title] },
    { id: "page-products",   group: groupPages,    icon: Package,         label: nav.products ?? "Products",     href: wl("/admin/products"),         keywords: ["products", "inventory", "catalog", prod.title] },
    { id: "page-orders",     group: groupPages,    icon: ShoppingCart,    label: nav.orders ?? "Orders",         href: wl("/admin/orders"),           keywords: ["orders", "sales"] },
    { id: "page-customers",  group: groupPages,    icon: Users,           label: nav.customers ?? "Customers",   href: wl("/admin/customers"),        keywords: ["customers", "users", "clients"] },
    { id: "page-settings",   group: groupPages,    icon: Settings,        label: nav.settings ?? "Settings",     href: wl("/admin/settings"),         keywords: ["settings", "configuration", "preferences"] },

    // Settings sub-sections (deep-linked via ?tab=)
    { id: "set-general",        group: groupSettings, icon: Store,       label: sec.general        ?? "General",        description: settingsTitle, href: wl("/admin/settings?tab=general"),        keywords: ["general", "store", "info"] },
    { id: "set-hero",           group: groupSettings, icon: Layers,      label: sec.hero           ?? "Hero",           description: settingsTitle, href: wl("/admin/settings?tab=hero"),           keywords: ["hero", "banner", "carousel", "slides"] },
    { id: "set-announcements",  group: groupSettings, icon: Megaphone,   label: sec.announcements  ?? "Announcements",  description: settingsTitle, href: wl("/admin/settings?tab=announcements"),  keywords: ["announcements", "marquee", "promo", "banner", ann.title] },
    { id: "set-payments",       group: groupSettings, icon: CreditCard,  label: sec.payments       ?? "Payments",       description: settingsTitle, href: wl("/admin/settings?tab=payments"),       keywords: ["payments", "stripe", "checkout"] },
    { id: "set-shipping",       group: groupSettings, icon: Truck,       label: sec.shipping       ?? "Shipping",       description: settingsTitle, href: wl("/admin/settings?tab=shipping"),       keywords: ["shipping", "delivery", "rates"] },
    { id: "set-notifications",  group: groupSettings, icon: Bell,        label: sec.notifications  ?? "Notifications",  description: settingsTitle, href: wl("/admin/settings?tab=notifications"),  keywords: ["notifications", "emails", "alerts"] },
    { id: "set-integrations",   group: groupSettings, icon: Zap,         label: sec.integrations   ?? "Integrations",   description: settingsTitle, href: wl("/admin/settings?tab=integrations"),   keywords: ["integrations", "api", "webhooks"] },
    { id: "set-localization",   group: groupSettings, icon: Globe,       label: sec.localization   ?? "Localization",   description: settingsTitle, href: wl("/admin/settings?tab=localization"),   keywords: ["localization", "language", "currency", "i18n"] },

    // Quick actions
    { id: "act-add-product",      group: groupActions, icon: Plus, label: prod.add ?? dash.add_product ?? "Add Product",   description: nav.products,                          href: wl("/admin/products?new=1"),               keywords: ["add product", "new product", "create"] },
    { id: "act-add-announcement", group: groupActions, icon: Plus, label: ann.add ?? "Add Announcement",                   description: sec.announcements ?? "Announcements",  href: wl("/admin/settings?tab=announcements&new=1"), keywords: ["add announcement", "new announcement", "banner"] },
  ];
}

export default function AdminSearch({ locale, isRtl }) {
  const dict = useDictionary();
  const t = dict?.admin?.search ?? {};
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  const index = useMemo(() => buildIndex({ dict, locale, t }), [dict, locale, t]);

  // Filter + score: prefix > word-start > substring. Returns at most 8 results.
  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    const scored = [];
    for (const item of index) {
      const haystacks = [item.label, item.description, ...(item.keywords ?? [])]
        .filter(Boolean)
        .map(normalize);
      let best = -1;
      for (const h of haystacks) {
        if (!h) continue;
        if (h === q)                  { best = Math.max(best, 100); continue; }
        if (h.startsWith(q))          { best = Math.max(best, 80);  continue; }
        if (h.includes(` ${q}`))      { best = Math.max(best, 60);  continue; }
        if (h.includes(q))            { best = Math.max(best, 40);  continue; }
      }
      if (best >= 0) scored.push({ item, score: best });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map((s) => s.item);
  }, [index, query]);

  // Group results by their `group` field, preserving discovery order.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of results) {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group).push(r);
    }
    return Array.from(map.entries());
  }, [results]);

  // Reset highlighted row whenever the result set changes.
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Close on route change.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Click-outside + Cmd/Ctrl+K shortcut.
  useEffect(() => {
    function onPointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  const go = (item) => {
    if (!item) return;
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(item.href);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIdx]) go(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  // Flat lookup for keyboard nav (groups are visual only).
  let runningIdx = -1;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className={`absolute h-4 w-4 text-zinc-400 pointer-events-none ${isRtl ? "right-3" : "left-3"}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={dict?.admin?.search_placeholder ?? "Search..."}
          aria-label={dict?.admin?.search_placeholder ?? "Search"}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="admin-search-listbox"
          className={`w-full sm:w-64 md:w-72 rounded-full border border-zinc-200 bg-zinc-50 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 focus:bg-white transition-colors ${
            isRtl ? "pr-10 pl-12" : "pl-10 pr-12"
          }`}
        />
        <kbd
          className={`absolute hidden md:inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 select-none ${
            isRtl ? "left-2.5" : "right-2.5"
          }`}
          aria-hidden="true"
        >
          {/Mac/i.test(typeof navigator !== "undefined" ? navigator.platform : "") ? "⌘K" : "Ctrl+K"}
        </kbd>
      </div>

      {open && (
        <div
          id="admin-search-listbox"
          role="listbox"
          ref={listRef}
          className={`absolute top-full mt-2 w-full sm:w-[min(28rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/5 z-[60] ${
            isRtl ? "right-0" : "left-0"
          }`}
        >
          {!query.trim() ? (
            <div className="p-6 text-center">
              <Search className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-sm font-medium text-zinc-700">
                {t.hint_title ?? "Type to search"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {t.hint_desc ?? "Find pages, settings and quick actions."}
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium text-zinc-700">
                {t.no_results ?? "No results found"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {(t.no_results_hint ?? "No matches for “{q}”.").replace("{q}", query)}
              </p>
            </div>
          ) : (
            <>
              {grouped.map(([group, items]) => (
                <div key={group} className="py-1">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {group}
                  </div>
                  <ul>
                    {items.map((item) => {
                      runningIdx += 1;
                      const idx = runningIdx;
                      const Icon = item.icon ?? Search;
                      const isActive = idx === activeIdx;
                      return (
                        <li
                          key={item.id}
                          data-idx={idx}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onMouseDown={(e) => { e.preventDefault(); go(item); }}
                          className={`mx-1 flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            isActive ? "bg-blue-50 text-blue-700" : "text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          <span className={`grid place-items-center h-8 w-8 rounded-lg shrink-0 ${
                            isActive ? "bg-blue-100 text-blue-600" : "bg-zinc-100 text-zinc-600"
                          }`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium truncate">{item.label}</span>
                            {item.description && (
                              <span className="block text-[11px] text-zinc-500 truncate">{item.description}</span>
                            )}
                          </span>
                          {isActive && (
                            <CornerDownLeft className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              <div className="hidden md:flex items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" />
                    {t.kbd_navigate ?? "Navigate"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CornerDownLeft className="h-3 w-3" />
                    {t.kbd_open ?? "Open"}
                  </span>
                </span>
                <span>{(t.kbd_close ?? "Esc to close")}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
