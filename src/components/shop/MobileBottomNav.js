"use client";

/**
 * MobileBottomNav
 *
 * Storefront-wide bottom tab bar shown on small/medium devices. Admin
 * controls both the enable/disable flag and which individual buttons appear
 * via `store_settings` (see `src/lib/display-settings.js`, keys prefixed
 * `mobile_nav_*`).
 *
 * Behaviour:
 *  - Hidden entirely on `lg+` breakpoints (desktop already has a header nav).
 *  - Auto-hides on any pathname whose second segment is one of the
 *    `HIDE_ON_ROUTES` — checkout, order confirmation, invoice, etc — so it
 *    never overlaps flow-critical bottom CTAs.
 *  - Cart button opens the same `<CartSidebar/>` used by the header.
 *  - Grid columns adapt to the number of enabled buttons (so an admin who
 *    only ships Home + Cart doesn't end up with awkward empty slots).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Home, Heart, User, Package, Menu as MenuIcon } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useDisplaySettings } from "@/components/providers/DisplaySettingsProvider";
import { useCartStore } from "@/store/useCartStore";
import CartSidebar from "@/components/ui/CartSidebar";
import ShopSidebarNav from "@/components/shop/ShopSidebarNav";
import { resolveCartIcon, DEFAULT_HEADER_CART_ICON, resolveSidebarTheme, DEFAULT_SIDEBAR_THEME } from "@/lib/storefront-ui";

/** Routes where the bottom nav must not appear (checkout flows etc.). */
const HIDE_ON_ROUTES = new Set([
  "checkout",
  "order-confirmed",
  "invoice",
  "track-order",
  "login",
  "signup",
  "forgot-password",
  "reset-password",
  "contact",
  "admin",
]);

/** Locale segments that need to be stripped before matching HIDE_ON_ROUTES. */
function segmentAfterLocale(pathname, locale) {
  if (!pathname) return "";
  const trimmed = pathname.replace(/^\/+/, "");
  const parts = trimmed.split("/");
  // parts[0] is the locale, parts[1] is the actual route root
  if (parts[0] === locale) return parts[1] ?? "";
  return parts[0] ?? "";
}

export default function MobileBottomNav() {
  const settings = useDisplaySettings();
  const dict = useDictionary();
  const t = dict?.mobile_nav ?? {};

  const params = useParams();
  const locale = params?.locale ?? "en";
  const pathname = usePathname();
  const currentRoot = segmentAfterLocale(pathname, locale);

  const { items } = useCartStore();
  const cartCount = items.reduce((acc, i) => acc + i.quantity, 0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Cart icon respects the admin-selected header cart icon so the bottom
  // nav visually matches the header.
  const CartIcon = resolveCartIcon(
    settings?.header_cart_icon ?? DEFAULT_HEADER_CART_ICON
  ).Icon;

  // Bar colors follow the admin-selected sidebar theme so the bottom nav
  // reads as one visual system with the drawer it opens.
  const theme = resolveSidebarTheme(
    settings?.sidebar_theme ?? DEFAULT_SIDEBAR_THEME
  );

  // Buttons in fixed left-to-right order. Admin toggles each on/off; disabled
  // ones are skipped. The grid below sizes itself based on how many remain.
  const buttons = useMemo(() => {
    const items = [
      {
        key: "home",
        show: settings?.mobile_nav_show_home !== "false",
        label: t.home ?? "Home",
        href: `/${locale}`,
        Icon: Home,
        matches: (root) => root === "",
      },
      {
        key: "favorites",
        show: settings?.mobile_nav_show_favorites !== "false",
        label: t.favorites ?? "Favorites",
        href: `/${locale}/favorites`,
        Icon: Heart,
        matches: (root) => root === "favorites",
      },
      {
        key: "cart",
        show: settings?.mobile_nav_show_cart !== "false",
        label: t.cart ?? "Cart",
        onClick: () => setIsCartOpen(true),
        Icon: CartIcon,
        badge: cartCount,
      },
      {
        key: "orders",
        show: settings?.mobile_nav_show_orders === "true",
        label: t.orders ?? "Orders",
        href: `/${locale}/orders`,
        Icon: Package,
        matches: (root) => root === "orders",
      },
      {
        key: "account",
        show: settings?.mobile_nav_show_account !== "false",
        label: t.account ?? "Account",
        href: `/${locale}/account`,
        Icon: User,
        matches: (root) => root === "account",
      },
      {
        key: "menu",
        show: settings?.mobile_nav_show_menu !== "false",
        label: t.menu ?? "Menu",
        onClick: () => setIsMenuOpen(true),
        Icon: MenuIcon,
      },
    ];
    return items.filter((b) => b.show);
  }, [settings, locale, t, CartIcon, cartCount]);

  // Master enable flag OR nothing to show → render nothing.
  const enabled = settings?.mobile_nav_enabled !== "false";
  if (!enabled) return null;
  if (buttons.length === 0) return null;
  if (HIDE_ON_ROUTES.has(currentRoot)) return null;

  const colsClass =
    buttons.length === 1
      ? "grid-cols-1"
      : buttons.length === 2
        ? "grid-cols-2"
        : buttons.length === 3
          ? "grid-cols-3"
          : buttons.length === 4
            ? "grid-cols-4"
            : buttons.length === 5
              ? "grid-cols-5"
              : "grid-cols-6";

  return (
    <>
      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <ShopSidebarNav isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      {/* Spacer so page content isn't overlapped by the fixed bar. */}
      <div aria-hidden="true" className="h-16 lg:hidden" />
      <nav
        aria-label={t.aria ?? "Bottom navigation"}
        className={`fixed bottom-0 inset-x-0 z-40 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden ${theme.bottomBar}`}
      >
        <div className={`grid ${colsClass} h-16`}>
          {buttons.map(({ key, label, href, onClick, Icon, badge, matches }) => {
            const active =
              typeof matches === "function" ? matches(currentRoot) : false;
            const content = (
              <div className="flex h-full flex-col items-center justify-center gap-1 relative">
                <div className="relative">
                  <Icon
                    className={`h-6 w-6 ${active ? theme.bottomActive : theme.bottomIdle}`}
                    strokeWidth={active ? 2 : 1.75}
                  />
                  {badge > 0 && (
                    <span className={`absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${theme.bottomBadge}`}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium ${active ? theme.bottomActive : theme.bottomIdle}`}
                >
                  {label}
                </span>
              </div>
            );

            if (onClick) {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  aria-label={label}
                  className={`w-full h-full transition-colors ${theme.bottomPress}`}
                >
                  {content}
                </button>
              );
            }
            return (
              <Link
                key={key}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`w-full h-full transition-colors ${theme.bottomPress}`}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
