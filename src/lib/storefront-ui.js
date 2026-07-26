// Registry of user-selectable icons + themes for the storefront header and
// sidebar drawer. The same metadata is consumed by:
//   • the admin settings tab (renders pickers)
//   • ShopHeader / ShopSidebarNav (renders the actual UI)
//
// Adding a new option here automatically propagates to both places.

import {
  ShoppingCart,
  ShoppingBag,
  ShoppingBasket,
  Store,
  Menu,
  LayoutGrid,
  AlignJustify,
  PanelLeft,
} from "lucide-react";

export const HEADER_CART_ICONS = {
  cart: { label: "Cart", Icon: ShoppingCart },
  bag: { label: "Bag", Icon: ShoppingBag },
  basket: { label: "Basket", Icon: ShoppingBasket },
  store: { label: "Store", Icon: Store },
};

export const HEADER_MENU_ICONS = {
  menu: { label: "Lines", Icon: Menu },
  grid: { label: "Grid", Icon: LayoutGrid },
  align: { label: "Justify", Icon: AlignJustify },
  panel: { label: "Panel", Icon: PanelLeft },
};

// Sidebar drawer themes.
//   - `panel`: root drawer classes (bg + text color)
//   - `header`: top bar inside the drawer
//   - `divider`: separator color inside the drawer
//   - `link`: text/hover styles for regular row links
//   - `linkIcon`: icon color for row links
//   - `close`: close button style
//   - `accent`: primary color used for CTA buttons / admin badge
export const SIDEBAR_THEMES = {
  minimal: {
    label: "Minimal",
    description: "Clean white — current default",
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
    description: "Dark theme with light text",
    swatch: ["#09090b", "#ffffff"],
    panel: "bg-zinc-950 text-zinc-100",
    header: "border-b border-zinc-800",
    divider: "border-zinc-800",
    link: "text-zinc-200 hover:bg-zinc-900 hover:text-white",
    linkIcon: "text-white group-hover:text-white",
    linkStrongText: "text-zinc-100",
    close: "text-white hover:bg-zinc-900 hover:text-white",
    accent: "bg-white text-zinc-900 hover:bg-zinc-100",
    accentBadge: "bg-zinc-900/10 text-zinc-900",
    invertLogo: true,
  },
  elegant: {
    label: "Elegant",
    description: "Cream background with gold accents",
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
    label: "Vibrant",
    description: "Soft gradient with blue accents",
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
