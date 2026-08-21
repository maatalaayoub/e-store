"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LogOut,
  User as UserIcon,
  Home as HomeIcon,
  ShoppingBag,
  LayoutGrid,
  Info,
  ChevronRight,
  ChevronLeft,
  Settings2,
  ClipboardList,
  Heart,
  Shield,
  Phone,
  X as XIcon,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useDisplaySettings } from "@/components/providers/DisplaySettingsProvider";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import { isRtlLocale } from "@/config/constants";
import { resolveSidebarTheme, DEFAULT_SIDEBAR_THEME } from "@/lib/storefront-ui";

export default function ShopSidebarNav({ isOpen, onClose }) {
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale || "en";
  const isRtl = isRtlLocale(locale);
  const logoutIconDirectionClass = isRtl ? "" : "-scale-x-100";
  const dict = useDictionary();
  const tNav = dict?.nav ?? {};
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [logo, setLogo] = useState({ url: "", urlDark: "", size: "140", height: "35" });
  const [themeKey, setThemeKey] = useState(DEFAULT_SIDEBAR_THEME);
  const theme = resolveSidebarTheme(themeKey);
  // Prefer the dark-variant logo on dark themes, but fall back gracefully.
  const activeLogo = theme.invertLogo && logo.urlDark ? logo.urlDark : logo.url;

  // When the mobile bottom nav is enabled AND has the "Menu" tab active,
  // any destination that already lives in the bottom nav is hidden here on
  // small screens (< lg) so we don't duplicate the same links twice. Desktop
  // (where the bottom nav isn't rendered) keeps all entries intact.
  const displaySettings = useDisplaySettings();
  const mobileNavActive =
    displaySettings?.mobile_nav_enabled !== "false" &&
    displaySettings?.mobile_nav_show_menu !== "false";
  const hideFavoritesOnMobile =
    mobileNavActive && displaySettings?.mobile_nav_show_favorites !== "false";
  const hideOrdersOnMobile =
    mobileNavActive && displaySettings?.mobile_nav_show_orders === "true";
  const hideAccountOnMobile =
    mobileNavActive && displaySettings?.mobile_nav_show_account !== "false";
  const hiddenOnMobileClass = "hidden lg:flex";

  useEffect(() => {
    fetch("/api/v1/display-settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setLogo({
            url: json.data.store_logo ?? "",
            urlDark: json.data.store_logo_dark ?? "",
            size: json.data.store_logo_size ?? "140",
            height: json.data.store_logo_height ?? "35",
          });
          if (json.data.sidebar_theme) setThemeKey(json.data.sidebar_theme);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          const res = await fetch('/api/v1/auth/is-admin', { signal: controller.signal });
          const data = await res.json();
          if (mounted) setUserIsAdmin(data.isAdmin === true);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') { /* ignore */ }
      }
    };
    loadUser().catch(() => {});

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          setUser(session?.user || null);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setUserIsAdmin(false);
        }
      }
    );

    return () => {
      mounted = false;
      controller.abort();
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const bottomLinks = [
    { href: `/${locale}/about`, label: tNav.about ?? "About Us", Icon: Info },
    { href: `/${locale}/privacy`, label: tNav.privacy_policy ?? "Privacy Policy", Icon: Shield },
    { href: `/${locale}/contact`, label: tNav.contact ?? "Contact Us", Icon: Phone },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 z-[100] h-[100dvh] w-[85vw] max-w-sm shadow-2xl transition-all duration-300 ease-in-out flex flex-col ${theme.panel} ${
          isRtl ? "right-0" : "left-0"
        } ${
          isOpen
            ? "translate-x-0"
            : isRtl
            ? "translate-x-[100%]"
            : "-translate-x-[100%]"
        }`}
      >
        <div className={`flex h-16 items-center justify-between px-5 shrink-0 ${theme.header}`}>
          <button
            className={`p-2 rounded-full active:scale-95 transition-all duration-200 ${theme.close}`}
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <XIcon className="w-5 h-5" />
          </button>
          {activeLogo ? (
            <Image
              src={activeLogo}
              alt="LaCérémonie"
              width={Math.min(Math.max(parseInt(logo.size || '140', 10) || 140, 80), 320)}
              height={Math.min(Math.max(parseInt(logo.height || '35', 10) || 35, 20), 120)}
              className="h-auto w-auto max-w-full object-contain"
              style={{ maxHeight: `${Math.min(Math.max(parseInt(logo.height || '35', 10) || 35, 20), 120)}px` }}
            />
          ) : (
            <div className="h-5 w-32" />
          )}
        </div>

        <div className="flex flex-col flex-1 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

          {/* ── User section (top) ── */}
          {user ? (
            <div
              className={`mx-5 mt-4 mb-2 transition-all duration-500 ease-out transform ${
                isOpen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              }`}
              style={{ transitionDelay: `${isOpen ? 120 : 0}ms` }}
            >
              <div className="mt-0 flex flex-col gap-0.5">
                <Link href={`/${locale}/orders`} onClick={onClose} className={`group ${hideOrdersOnMobile ? hiddenOnMobileClass : "flex"} items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${theme.link}`}>
                  <ClipboardList className={`h-5 w-5 shrink-0 ${theme.linkIcon}`} strokeWidth={1.5} />
                  <span>{tNav.my_orders ?? "My Orders"}</span>
                </Link>
                <Link href={`/${locale}/favorites`} onClick={onClose} className={`group ${hideFavoritesOnMobile ? hiddenOnMobileClass : "flex"} items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${theme.link}`}>
                  <Heart className={`h-5 w-5 shrink-0 ${theme.linkIcon}`} strokeWidth={1.5} />
                  <span>{tNav.favorites ?? "Favorites"}</span>
                </Link>
                <Link href={`/${locale}/categories`} onClick={onClose} className={`group flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${theme.link}`}>
                  <LayoutGrid className={`h-5 w-5 shrink-0 ${theme.linkIcon}`} strokeWidth={1.5} />
                  <span>{tNav.categories ?? "Categories"}</span>
                </Link>
                <Link href={`/${locale}/account`} onClick={onClose} className={`group ${hideAccountOnMobile ? hiddenOnMobileClass : "flex"} items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${theme.link}`}>
                  <UserIcon className={`h-5 w-5 shrink-0 ${theme.linkIcon}`} strokeWidth={1.5} />
                  <span>{tNav.account_settings ?? "Account Settings"}</span>
                </Link>
                {userIsAdmin && (
                  <Link
                    href={`/${locale}/admin`}
                    onClick={onClose}
                    className={`group mt-2 flex items-center gap-3 rounded-[5px] px-3 py-2.5 transition-colors active:scale-[0.99] ${theme.accent}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] ${theme.accentBadge}`}>
                      <Settings2 className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="flex flex-1 flex-col leading-tight">
                      <span className="text-[15px] font-semibold">{tNav.dashboard ?? "Dashboard"}</span>
                      <span className="text-[11px] font-medium uppercase tracking-wider opacity-70">
                        {tNav.admin_panel ?? "Admin panel"}
                      </span>
                    </span>
                    {isRtl ? (
                      <ChevronLeft className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:-translate-x-0.5" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
                    )}
                  </Link>
                )}
              </div>
            </div>
          ) : (
            /* ── Guest: Categories + Track Order + Contact ── */
            <nav className="flex flex-col py-4">
              {[
                { href: `/${locale}/categories`, label: tNav.categories ?? "Categories", Icon: LayoutGrid },
                { href: `/${locale}/track-order`, label: tNav.track_order ?? "Track Order", Icon: Search },
                { href: `/${locale}/contact`, label: tNav.contact ?? "Contact Us", Icon: Phone },
              ].map((linkItem, idx) => {
                const Chevron = isRtl ? ChevronLeft : ChevronRight;
                return (
                  <Link
                    key={linkItem.href}
                    href={linkItem.href}
                    onClick={onClose}
                    className={`group flex items-center gap-4 px-5 py-3.5 text-base font-medium transition-all duration-500 ease-out transform ${theme.link} ${
                      isOpen ? "translate-x-0 opacity-100" : isRtl ? "translate-x-8 opacity-0" : "-translate-x-8 opacity-0"
                    }`}
                    style={{ transitionDelay: `${isOpen ? idx * 60 + 120 : 0}ms` }}
                  >
                    <linkItem.Icon className={`h-5 w-5 transition-colors shrink-0 ${theme.linkIcon}`} strokeWidth={1.5} />
                    <span className="flex-1">{linkItem.label}</span>
                    <Chevron className={`h-4 w-4 transition-all ${theme.linkIcon}`} />
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex-1" />

          {/* ── Bottom: About, Privacy, Contact ── */}
          <div className={`md:hidden mx-5 border-t py-2 flex flex-col gap-0.5 ${theme.divider}`}>
            {bottomLinks.map((linkItem) => (
              <Link
                key={linkItem.href}
                href={linkItem.href}
                onClick={onClose}
                className={`group flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${theme.link}`}
              >
                <linkItem.Icon className={`h-5 w-5 shrink-0 ${theme.linkIcon}`} strokeWidth={1.5} />
                <span>{linkItem.label}</span>
              </Link>
            ))}
          </div>

          <div className={`border-t shrink-0 ${theme.divider}`}>
            {!user && (
              <div
                className={`flex gap-2.5 px-5 pt-5 transition-all duration-500 ease-out transform ${
                  isOpen
                    ? "translate-y-0 opacity-100"
                    : "translate-y-6 opacity-0"
                }`}
                style={{ transitionDelay: `${isOpen ? 300 : 0}ms` }}
              >
                <Link
                  href={`/${locale}/login`}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors active:scale-95 ${theme.link}`}
                  onClick={onClose}
                >
                  <UserIcon className="h-4 w-4" />
                  <span>{tNav.login ?? "Log in"}</span>
                </Link>
                <Link
                  href={`/${locale}/signup`}
                  className={`flex-1 inline-flex items-center justify-center rounded-xl py-3 text-sm font-semibold shadow-md transition-colors active:scale-95 ${theme.accent}`}
                  onClick={onClose}
                >
                  {tNav.signup ?? "Create account"}
                </Link>
              </div>
            )}

            {user && (
              <div
                className={`px-5 pt-3 pb-1 transition-all duration-500 ease-out transform ${
                  isOpen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                }`}
                style={{ transitionDelay: `${isOpen ? 360 : 0}ms` }}
              >
                <button
                  onClick={() => { handleLogout(); onClose(); }}
                  className="flex w-full items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className={`h-5 w-5 shrink-0 ${logoutIconDirectionClass}`} strokeWidth={1.5} />
                  <span>{tNav.logout ?? "Log out"}</span>
                </button>
              </div>
            )}

            <div
              className={`flex items-center justify-between px-5 py-4 ${
                !user ? "mt-2" : ""
              } transition-all duration-500 ease-out transform ${
                isOpen
                  ? "translate-y-0 opacity-100"
                  : "translate-y-6 opacity-0"
              }`}
              style={{ transitionDelay: `${isOpen ? 380 : 0}ms` }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {dict?.common?.language}
              </span>
              <LocaleSwitcher align="right" direction="up" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
