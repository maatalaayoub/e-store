// Registry of user-selectable icons + themes for the storefront header and
// sidebar drawer. The same metadata is consumed by:
//   • the admin settings tab (renders pickers)
//   • ShopHeader / ShopSidebarNav / CartSidebar (renders the actual UI)
//
// Adding a new option here automatically propagates to both places.

import {
  ShoppingCart,
  ShoppingBag,
  ShoppingBasket,
  Store,
  Briefcase,
  Package,
  Gift,
  Handbag,
  Menu,
  LayoutGrid,
  AlignJustify,
  PanelLeft,
  PanelRight,
  SquareMenu,
  List,
  Layers,
} from "lucide-react";

// Classic outline shopping-bag icon used across the app before the picker
// existed. Kept as an option so admins can restore the original look.
function ClassicBagIcon({ className, strokeWidth = 1.5, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={strokeWidth}
      stroke="currentColor"
      className={className}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    </svg>
  );
}

export const HEADER_CART_ICONS = {
  classic:   { label: "Classic",   Icon: ClassicBagIcon },
  cart:      { label: "Cart",      Icon: ShoppingCart },
  bag:       { label: "Bag",       Icon: ShoppingBag },
  basket:    { label: "Basket",    Icon: ShoppingBasket },
  handbag:   { label: "Handbag",   Icon: Handbag },
  briefcase: { label: "Briefcase", Icon: Briefcase },
  package:   { label: "Package",   Icon: Package },
  gift:      { label: "Gift",      Icon: Gift },
  store:     { label: "Store",     Icon: Store },
};

export const HEADER_MENU_ICONS = {
  menu:          { label: "Lines",       Icon: Menu },
  grid:          { label: "Grid",        Icon: LayoutGrid },
  align:         { label: "Justify",     Icon: AlignJustify },
  panel:         { label: "Panel Left",  Icon: PanelLeft },
  "panel-right": { label: "Panel Right", Icon: PanelRight },
  square:        { label: "Square Menu", Icon: SquareMenu },
  list:          { label: "List",        Icon: List },
  layers:        { label: "Layers",      Icon: Layers },
};

// Sidebar drawer themes.
//   - `panel`: root drawer classes (bg + text color)
//   - `header`: top bar inside the drawer
//   - `divider`: separator color inside the drawer
//   - `link`: text/hover styles for regular row links
//   - `linkIcon`: icon color for row links
//   - `close`: close button style
//   - `accent`: primary color used for CTA buttons / admin badge
//   - `accentBadge`: inner badge style that stays legible on top of `accent`
//   - `invertLogo`: when true, prefer the admin's dark-mode store logo
//                   (falls back to the default logo if none is set)
export const SIDEBAR_THEMES = {
  minimal: {
    label: "Minimal",
    description: "Clean white — the classic default",
    swatch: ["#ffffff", "#18181b"],
    panel: "bg-white text-zinc-900",
    header: "border-b border-zinc-100",
    divider: "border-zinc-100",
    link: "text-zinc-800 hover:bg-zinc-50 hover:text-zinc-900",
    linkIcon: "text-zinc-400 group-hover:text-zinc-900",
    linkStrongText: "text-zinc-700",
    close: "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
    accent: "bg-zinc-900 text-white hover:bg-zinc-800",
    accentBadge: "bg-white/20 text-white",
    invertLogo: false,
  },
  dark: {
    label: "Midnight",
    description: "Deep dark background with white icons",
    swatch: ["#09090b", "#ffffff"],
    panel: "bg-zinc-950 text-zinc-100",
    header: "border-b border-zinc-800",
    divider: "border-zinc-800",
    link: "text-zinc-100 hover:bg-zinc-900 hover:text-white",
    linkIcon: "text-white group-hover:text-white",
    linkStrongText: "text-zinc-100",
    close: "text-white hover:bg-zinc-900",
    accent: "bg-white text-zinc-900 hover:bg-zinc-100",
    accentBadge: "bg-zinc-900/10 text-zinc-900",
    invertLogo: true,
  },
  slate: {
    label: "Slate",
    description: "Cool, professional grey tones",
    swatch: ["#f1f5f9", "#334155"],
    panel: "bg-slate-50 text-slate-900",
    header: "border-b border-slate-200",
    divider: "border-slate-200",
    link: "text-slate-800 hover:bg-slate-100 hover:text-slate-900",
    linkIcon: "text-slate-500 group-hover:text-slate-900",
    linkStrongText: "text-slate-800",
    close: "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    accent: "bg-slate-800 text-white hover:bg-slate-700",
    accentBadge: "bg-white/20 text-white",
    invertLogo: false,
  },
  elegant: {
    label: "Elegant",
    description: "Cream background with warm gold accents",
    swatch: ["#faf7f0", "#8b6f2f"],
    panel: "bg-[#faf7f0] text-[#3f3223]",
    header: "border-b border-[#e8dfc9]",
    divider: "border-[#e8dfc9]",
    link: "text-[#4a3a25] hover:bg-[#f3ecd8] hover:text-[#2d2213]",
    linkIcon: "text-[#a89468] group-hover:text-[#7a5f2b]",
    linkStrongText: "text-[#3f3223]",
    close: "text-[#7a6339] hover:bg-[#f3ecd8] hover:text-[#3f3223]",
    accent: "bg-[#8b6f2f] text-white hover:bg-[#6f5824]",
    accentBadge: "bg-white/20 text-white",
    invertLogo: false,
  },
  vibrant: {
    label: "Ocean",
    description: "Soft blue gradient with vivid accents",
    swatch: ["#eef4ff", "#2563eb"],
    panel: "bg-gradient-to-b from-blue-50 via-white to-white text-zinc-900",
    header: "border-b border-blue-100",
    divider: "border-blue-100",
    link: "text-zinc-800 hover:bg-blue-50 hover:text-blue-700",
    linkIcon: "text-blue-400 group-hover:text-blue-700",
    linkStrongText: "text-zinc-800",
    close: "text-blue-500 hover:bg-blue-50 hover:text-blue-700",
    accent: "bg-blue-600 text-white hover:bg-blue-700",
    accentBadge: "bg-white/20 text-white",
    invertLogo: false,
  },
  emerald: {
    label: "Emerald",
    description: "Fresh, natural green — pairs well with organic brands",
    swatch: ["#ecfdf5", "#059669"],
    panel: "bg-gradient-to-b from-emerald-50 via-white to-white text-zinc-900",
    header: "border-b border-emerald-100",
    divider: "border-emerald-100",
    link: "text-zinc-800 hover:bg-emerald-50 hover:text-emerald-700",
    linkIcon: "text-emerald-500 group-hover:text-emerald-700",
    linkStrongText: "text-zinc-800",
    close: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
    accent: "bg-emerald-600 text-white hover:bg-emerald-700",
    accentBadge: "bg-white/20 text-white",
    invertLogo: false,
  },
  rose: {
    label: "Rose",
    description: "Warm pink pastel — beauty and fashion friendly",
    swatch: ["#fff1f2", "#e11d48"],
    panel: "bg-gradient-to-b from-rose-50 via-white to-white text-zinc-900",
    header: "border-b border-rose-100",
    divider: "border-rose-100",
    link: "text-zinc-800 hover:bg-rose-50 hover:text-rose-700",
    linkIcon: "text-rose-400 group-hover:text-rose-700",
    linkStrongText: "text-zinc-800",
    close: "text-rose-500 hover:bg-rose-50 hover:text-rose-700",
    accent: "bg-rose-600 text-white hover:bg-rose-700",
    accentBadge: "bg-white/20 text-white",
    invertLogo: false,
  },
  sunset: {
    label: "Sunset",
    description: "Warm amber gradient with orange accents",
    swatch: ["#fff7ed", "#ea580c"],
    panel: "bg-gradient-to-b from-amber-50 via-orange-50 to-white text-zinc-900",
    header: "border-b border-orange-100",
    divider: "border-orange-100",
    link: "text-zinc-800 hover:bg-orange-50 hover:text-orange-700",
    linkIcon: "text-orange-400 group-hover:text-orange-700",
    linkStrongText: "text-zinc-800",
    close: "text-orange-500 hover:bg-orange-50 hover:text-orange-700",
    accent: "bg-orange-600 text-white hover:bg-orange-700",
    accentBadge: "bg-white/20 text-white",
    invertLogo: false,
  },
  royal: {
    label: "Royal",
    description: "Deep indigo with luxurious violet accents",
    swatch: ["#1e1b4b", "#a78bfa"],
    panel: "bg-indigo-950 text-indigo-50",
    header: "border-b border-indigo-900",
    divider: "border-indigo-900",
    link: "text-indigo-100 hover:bg-indigo-900 hover:text-white",
    linkIcon: "text-indigo-200 group-hover:text-white",
    linkStrongText: "text-white",
    close: "text-indigo-200 hover:bg-indigo-900 hover:text-white",
    accent: "bg-violet-500 text-white hover:bg-violet-400",
    accentBadge: "bg-white/20 text-white",
    invertLogo: true,
  },
};

export const DEFAULT_HEADER_CART_ICON = "cart";
export const DEFAULT_HEADER_MENU_ICON = "menu";
export const DEFAULT_SIDEBAR_THEME = "minimal";

export function resolveCartIcon(key) {
  return HEADER_CART_ICONS[key] ?? HEADER_CART_ICONS[DEFAULT_HEADER_CART_ICON];
}

export function resolveMenuIcon(key) {
  return HEADER_MENU_ICONS[key] ?? HEADER_MENU_ICONS[DEFAULT_HEADER_MENU_ICON];
}

export function resolveSidebarTheme(key) {
  return SIDEBAR_THEMES[key] ?? SIDEBAR_THEMES[DEFAULT_SIDEBAR_THEME];
}
