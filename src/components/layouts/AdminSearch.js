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
  Mail,
  Blocks,
  UserCog,
  AlertTriangle,
  XCircle,
  Package as PackageIcon,
  Tag,
  Film,
  LayoutTemplate,
  Smartphone,
  LayoutGrid,
  MapPin,
  Phone,
  Image as ImageIcon,
  Palette,
  Languages,
  Clock,
  DollarSign,
  Send,
  MessageCircle,
  Percent,
  UserPlus,
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
  const settings = dict?.admin?.settings ?? {};
  const dash = dict?.admin?.dashboard ?? {};
  const prod = dict?.admin?.products ?? {};
  const ann = settings.announcements ?? {};
  const notif = dict?.admin?.notifications ?? {};
  const messages = settings.messages ?? {};
  const marketing = dict?.admin?.marketing ?? {};
  const team = dict?.admin?.team ?? {};
  const storefrontTabs = settings.storefront_tabs ?? {};
  const gen = settings.general ?? {};
  const disp = settings.display ?? {};
  const car = settings.carousel ?? {};
  const mnav = settings.mobile_nav ?? {};
  const hdr = settings.header_sidebar ?? {};
  const pay = settings.payments ?? {};
  const ship = settings.shipping ?? {};
  const notifSet = settings.notifications ?? {};
  const intg = settings.integrations ?? {};
  const loc = settings.localization ?? {};
  const seoSet = settings.seo ?? {};
  const productSectionsSet = settings.product_sections ?? {};
  const settingsTitle = settings.title ?? "Settings";
  const storefrontTitle = sec.storefront ?? "Storefront";

  const groupPages = t.group_pages ?? "Pages";
  const groupSettings = t.group_settings ?? settingsTitle;
  const groupStorefront = t.group_storefront ?? storefrontTitle;
  const groupActions = t.group_actions ?? "Quick Actions";

  const wl = (href) => `/${locale}${href}`;

  return [
    // ─── Top-level pages ────────────────────────────────────────────────────
    { id: "page-dashboard",     group: groupPages, icon: LayoutDashboard,  label: nav.dashboard     ?? "Dashboard",     href: wl("/admin"),              keywords: ["dashboard", "home", "overview", dash.title] },
    { id: "page-products",      group: groupPages, icon: Package,          label: nav.products      ?? "Products",      href: wl("/admin/products"),     keywords: ["products", "inventory", "catalog", prod.title] },
    { id: "page-orders",        group: groupPages, icon: ShoppingCart,     label: nav.orders        ?? "Orders",        href: wl("/admin/orders"),       keywords: ["orders", "sales"] },
    { id: "page-customers",     group: groupPages, icon: Users,            label: nav.customers     ?? "Customers",     href: wl("/admin/customers"),    keywords: ["customers", "users", "clients"] },
    { id: "page-marketing",     group: groupPages, icon: Tag,              label: nav.marketing     ?? marketing.title ?? "Marketing", href: wl("/admin/marketing"), keywords: ["marketing", "promo", "promo code", "discount", "coupon", marketing.title] },
    { id: "page-messages",      group: groupPages, icon: Mail,             label: nav.messages      ?? "Messages",      href: wl("/admin/messages"),     keywords: ["messages", "contact", "inbox", messages.title] },
    { id: "page-notifications", group: groupPages, icon: Bell,             label: nav.notifications ?? "Notifications", href: wl("/admin/notifications"), keywords: ["notifications", "alerts", "updates", notif.title] },
    { id: "page-team",          group: groupPages, icon: UserCog,          label: nav.team          ?? team.title ?? "Team", href: wl("/admin/team"),  keywords: ["team", "staff", "members", "invite", "permissions", "roles", team.title] },
    { id: "page-settings",      group: groupPages, icon: Settings,         label: nav.settings      ?? "Settings",      href: wl("/admin/settings"),     keywords: ["settings", "configuration", "preferences"] },

    // ─── Settings top-level tabs (deep-linked via ?tab=) ─────────────────────
    { id: "set-general",          group: groupSettings, icon: Store,        label: sec.general          ?? "General",          description: settingsTitle, href: wl("/admin/settings?tab=general"),          keywords: ["general", "store", "info", "name", "logo", "contact", gen.title] },
    { id: "set-storefront",       group: groupSettings, icon: Layers,       label: sec.storefront       ?? "Storefront",       description: settingsTitle, href: wl("/admin/settings?tab=storefront"),       keywords: ["storefront", "hero", "banner", "carousel", "slides", "display", "buttons", "product cards"] },
    { id: "set-announcements",    group: groupSettings, icon: Megaphone,    label: sec.announcements    ?? "Announcements",    description: settingsTitle, href: wl("/admin/settings?tab=announcements"),    keywords: ["announcements", "marquee", "promo", "banner", "notice", ann.title] },
    { id: "set-product-sections", group: groupSettings, icon: Blocks,       label: sec.product_sections ?? "Product Sections", description: settingsTitle, href: wl("/admin/settings?tab=product_sections"), keywords: ["product sections", "sections", "product page", "homepage", "builder", productSectionsSet.title] },
    { id: "set-payments",         group: groupSettings, icon: CreditCard,   label: sec.payments         ?? "Payments",         description: settingsTitle, href: wl("/admin/settings?tab=payments"),         keywords: ["payments", "stripe", "checkout", "cod", "cash on delivery", "currency", pay.title] },
    { id: "set-order-methods",    group: groupSettings, icon: ShoppingCart,  label: sec.order_methods    ?? "Order Methods",    description: settingsTitle, href: wl("/admin/settings?tab=order_methods"),    keywords: ["order methods", "cod", "cash on delivery", "whatsapp", "online payment", "stripe", "checkout"] },
    { id: "set-shipping",         group: groupSettings, icon: Truck,        label: sec.shipping         ?? "Shipping",         description: settingsTitle, href: wl("/admin/settings?tab=shipping"),         keywords: ["shipping", "delivery", "rates", "zones", "flat rate", "origin country", ship.title] },
    { id: "set-notifications",    group: groupSettings, icon: Bell,         label: sec.notifications    ?? "Notifications",    description: settingsTitle, href: wl("/admin/settings?tab=notifications"),    keywords: ["notifications", "alerts", "telegram", "new order", "low stock", "out of stock", notifSet.title] },
    { id: "set-integrations",     group: groupSettings, icon: Zap,          label: sec.integrations     ?? "Integrations",     description: settingsTitle, href: wl("/admin/settings?tab=integrations"),     keywords: ["integrations", "api", "webhooks", "telegram", "whatsapp", intg.title] },
    { id: "set-seo",              group: groupSettings, icon: Search,       label: sec.seo              ?? "SEO",              description: settingsTitle, href: wl("/admin/settings?tab=seo"),              keywords: ["seo", "search engine", "meta", "title", "description", "open graph", "og", "sitemap", "robots", "keywords", "canonical", seoSet.title] },
    { id: "set-localization",     group: groupSettings, icon: Globe,        label: sec.localization     ?? "Localization",     description: settingsTitle, href: wl("/admin/settings?tab=localization"),     keywords: ["localization", "language", "currency", "i18n", "timezone", loc.title] },

    // ─── Storefront sub-tabs (deep-linked via ?tab=storefront&sub=) ─────────
    { id: "sub-hero",       group: groupStorefront, icon: Film,           label: storefrontTabs.hero       ?? "Hero Carousel",    description: storefrontTitle, href: wl("/admin/settings?tab=storefront&sub=hero"),       keywords: ["hero", "carousel", "banner", "slider", "slides", "homepage", "hero slider"] },
    { id: "sub-header",     group: groupStorefront, icon: LayoutTemplate, label: storefrontTabs.header     ?? "Header & Sidebar", description: storefrontTitle, href: wl("/admin/settings?tab=storefront&sub=header"),     keywords: ["header", "sidebar", "menu icon", "cart icon", "theme", "top bar", hdr.title] },
    { id: "sub-mobile-nav", group: groupStorefront, icon: Smartphone,     label: storefrontTabs.mobile_nav ?? "Mobile Nav",       description: storefrontTitle, href: wl("/admin/settings?tab=storefront&sub=mobile_nav"), keywords: ["mobile nav", "mobile navigation", "bottom bar", "bottom nav", "tab bar", "phone", mnav.title] },
    { id: "sub-display",    group: groupStorefront, icon: Palette,        label: storefrontTabs.display    ?? "Button Display",   description: storefrontTitle, href: wl("/admin/settings?tab=storefront&sub=display"),    keywords: ["button", "buttons", "product card", "cart button", "shop now", "colors", "colours", disp.title] },
    { id: "sub-layout",     group: groupStorefront, icon: LayoutGrid,     label: storefrontTabs.layout     ?? "Card Layout",      description: storefrontTitle, href: wl("/admin/settings?tab=storefront&sub=layout"),     keywords: ["card layout", "grid", "product card", "columns"] },
    { id: "sub-carousel",   group: groupStorefront, icon: Blocks,         label: storefrontTabs.carousel   ?? "Carousel",         description: storefrontTitle, href: wl("/admin/settings?tab=storefront&sub=carousel"),   keywords: ["carousel", "autoplay", "speed", "products per row", car.title] },

    // ─── Settings deep-links: General ───────────────────────────────────────
    { id: "gen-store-info",     group: groupSettings, icon: Store,      label: gen.store_name       ?? "Store name",       description: sec.general ?? "General", href: wl("/admin/settings?tab=general#store-info"),     keywords: ["store name", "store info", "brand", gen.store_name] },
    { id: "gen-contact",        group: groupSettings, icon: Phone,      label: gen.contact_email    ?? "Contact info",     description: sec.general ?? "General", href: wl("/admin/settings?tab=general#contact"),        keywords: ["contact", "email", "phone", "whatsapp", "address", gen.contact_email, gen.contact_phone, gen.contact_whatsapp, gen.contact_address] },
    { id: "gen-location",       group: groupSettings, icon: MapPin,     label: gen.store_location   ?? "Store location",   description: sec.general ?? "General", href: wl("/admin/settings?tab=general#location"),       keywords: ["location", "map", "address", "coordinates", "latitude", "longitude", gen.store_location] },
    { id: "gen-logo",           group: groupSettings, icon: ImageIcon,  label: gen.store_logo       ?? "Store logo",       description: sec.general ?? "General", href: wl("/admin/settings?tab=general#logo"),           keywords: ["logo", "brand", "image", gen.store_logo, gen.store_logo_dark] },
    { id: "gen-social",         group: groupSettings, icon: MessageCircle, label: gen.social_title  ?? "Social media",     description: sec.general ?? "General", href: wl("/admin/settings?tab=general#social"),         keywords: ["social", "instagram", "facebook", "tiktok", "whatsapp", gen.social_title] },

    // ─── Settings deep-links: Payments / Shipping ──────────────────────────
    { id: "pay-currency",   group: groupSettings, icon: DollarSign, label: pay.currency ?? "Currency",     description: sec.payments ?? "Payments",  href: wl("/admin/settings?tab=payments"),  keywords: ["currency", "mad", "usd", "eur", pay.currency] },
    { id: "pay-stripe",     group: groupSettings, icon: CreditCard, label: pay.stripe   ?? "Stripe",       description: sec.payments ?? "Payments",  href: wl("/admin/settings?tab=payments"),  keywords: ["stripe", "card payment", "api key", pay.stripe] },
    { id: "pay-cod",        group: groupSettings, icon: Truck,      label: pay.cod      ?? "Cash on delivery", description: sec.payments ?? "Payments", href: wl("/admin/settings?tab=payments"),  keywords: ["cod", "cash on delivery", "cash", pay.cod] },
    { id: "ship-flat",      group: groupSettings, icon: Truck,      label: ship.flat    ?? "Flat rate",    description: sec.shipping ?? "Shipping",  href: wl("/admin/settings?tab=shipping"),  keywords: ["flat rate", "shipping rate", ship.flat] },
    { id: "ship-free",      group: groupSettings, icon: Truck,      label: ship.free_threshold ?? "Free shipping threshold", description: sec.shipping ?? "Shipping", href: wl("/admin/settings?tab=shipping"), keywords: ["free shipping", "threshold", ship.free_threshold] },
    { id: "ship-origin",    group: groupSettings, icon: Globe,      label: ship.origin  ?? "Origin country", description: sec.shipping ?? "Shipping", href: wl("/admin/settings?tab=shipping"),  keywords: ["origin", "country", ship.origin] },

    // ─── Settings deep-links: Notifications & Integrations ─────────────────
    { id: "notif-low-thresh", group: groupSettings, icon: AlertTriangle, label: notifSet.low_stock_threshold ?? "Low stock threshold", description: sec.notifications ?? "Notifications", href: wl("/admin/settings?tab=notifications"), keywords: ["low stock", "threshold", notifSet.low_stock_threshold] },
    { id: "notif-telegram",   group: groupSettings, icon: Send,          label: notifSet.telegram_title      ?? "Telegram alerts",     description: sec.notifications ?? "Notifications", href: wl("/admin/settings?tab=notifications"), keywords: ["telegram", "bot", "alerts", notifSet.telegram_title] },
    { id: "intg-telegram",    group: groupSettings, icon: Send,          label: intg.telegram                ?? "Telegram Bot",         description: sec.integrations ?? "Integrations",  href: wl("/admin/settings?tab=integrations"),  keywords: ["telegram", "bot", "token", "chat id", intg.telegram, intg.bot_token, intg.chat_id] },
    { id: "intg-whatsapp",    group: groupSettings, icon: MessageCircle, label: intg.whatsapp                ?? "WhatsApp Business",    description: sec.integrations ?? "Integrations",  href: wl("/admin/settings?tab=integrations"),  keywords: ["whatsapp", "business", intg.whatsapp, intg.whatsapp_number] },

    // ─── Settings deep-links: Localization ─────────────────────────────────
    { id: "loc-language", group: groupSettings, icon: Languages, label: loc.default_language ?? "Default language", description: sec.localization ?? "Localization", href: wl("/admin/settings?tab=localization"), keywords: ["language", "english", "french", "arabic", "darija", loc.default_language] },
    { id: "loc-timezone", group: groupSettings, icon: Clock,     label: loc.timezone         ?? "Timezone",         description: sec.localization ?? "Localization", href: wl("/admin/settings?tab=localization"), keywords: ["timezone", "time", "tz", loc.timezone] },

    // ─── Quick actions ─────────────────────────────────────────────────────
    { id: "act-add-product",      group: groupActions, icon: Plus,        label: prod.add          ?? dash.add_product ?? "Add Product",     description: nav.products,                         href: wl("/admin/products?new=1"),                   keywords: ["add product", "new product", "create product"] },
    { id: "act-add-announcement", group: groupActions, icon: Megaphone,   label: ann.add           ?? "Add Announcement",                    description: sec.announcements ?? "Announcements", href: wl("/admin/settings?tab=announcements&new=1"), keywords: ["add announcement", "new announcement", "banner", "notice"] },
    { id: "act-add-promo",        group: groupActions, icon: Percent,     label: marketing.add_button ?? "Add promo code",                   description: marketing.title ?? "Marketing",       href: wl("/admin/marketing?new=1"),                  keywords: ["add promo", "new promo", "promo code", "coupon", "discount code", marketing.add_button] },
    { id: "act-invite-team",      group: groupActions, icon: UserPlus,    label: team.invite_button ?? "Invite team member",                 description: team.title ?? "Team",                 href: wl("/admin/team?new=1"),                       keywords: ["invite", "team", "member", "staff", "add user", team.invite_button] },

    // ─── Notifications filters ─────────────────────────────────────────────
    { id: "notif-unread",         group: notif.title ?? "Notifications", icon: Bell,          label: notif.filter_unread ?? "Unread",         description: notif.title ?? "Notifications", href: wl("/admin/notifications?tab=unread"),          keywords: ["unread", "notifications"] },
    { id: "notif-new-order",      group: notif.title ?? "Notifications", icon: ShoppingCart,  label: notif.type_new_order ?? "New order",     description: notif.title ?? "Notifications", href: wl("/admin/notifications?tab=new_order"),       keywords: ["new order", "order", "notification"] },
    { id: "notif-order-cancelled",group: notif.title ?? "Notifications", icon: XCircle,       label: notif.type_order_cancelled ?? "Order cancelled", description: notif.title ?? "Notifications", href: wl("/admin/notifications?tab=order_cancelled"), keywords: ["cancelled", "order", "notification"] },
    { id: "notif-low-stock",      group: notif.title ?? "Notifications", icon: AlertTriangle, label: notif.type_low_stock ?? "Low stock",     description: notif.title ?? "Notifications", href: wl("/admin/notifications?tab=low_stock"),       keywords: ["low stock", "stock", "notification"] },
    { id: "notif-out-of-stock",   group: notif.title ?? "Notifications", icon: PackageIcon,   label: notif.type_out_of_stock ?? "Out of stock", description: notif.title ?? "Notifications", href: wl("/admin/notifications?tab=out_of_stock"),    keywords: ["out of stock", "stock", "notification"] },

    // ─── Message filters ───────────────────────────────────────────────────
    { id: "msg-new",      group: messages.title ?? "Messages", icon: Mail, label: messages.filter_new      ?? "New",      description: messages.title ?? "Messages", href: wl("/admin/messages?status=new"),      keywords: ["new", "messages", "contact"] },
    { id: "msg-read",     group: messages.title ?? "Messages", icon: Mail, label: messages.filter_read     ?? "Read",     description: messages.title ?? "Messages", href: wl("/admin/messages?status=read"),     keywords: ["read", "messages", "contact"] },
    { id: "msg-replied",  group: messages.title ?? "Messages", icon: Mail, label: messages.filter_replied  ?? "Replied",  description: messages.title ?? "Messages", href: wl("/admin/messages?status=replied"),  keywords: ["replied", "messages", "contact"] },
    { id: "msg-archived", group: messages.title ?? "Messages", icon: Mail, label: messages.filter_archived ?? "Archived", description: messages.title ?? "Messages", href: wl("/admin/messages?status=archived"), keywords: ["archived", "messages", "contact"] },
  ].filter((it) => it && it.label && it.href);
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
          className="w-full sm:w-64 md:w-72 rounded-[3px] border border-zinc-200 bg-zinc-50 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 focus:bg-white transition-colors ps-10 pe-12"
        />
        <kbd
          className="absolute hidden md:inline-flex items-center gap-1 rounded-[3px] border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 select-none end-2.5"
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
          className={`absolute top-full mt-2 w-full sm:w-[min(28rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-[3px] border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/5 z-[60] ${
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
                          className={`mx-1 flex items-center gap-3 px-3 py-2 rounded-[3px] cursor-pointer transition-colors ${
                            isActive ? "bg-blue-50 text-blue-700" : "text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          <span className={`grid place-items-center h-8 w-8 rounded-[3px] shrink-0 ${
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
