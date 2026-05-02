"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDictionary } from "@/components/providers/LocaleProvider";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import { isRtlLocale } from "@/config/constants";

export default function ShopSidebarNav({ isOpen, onClose }) {
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale || "en";
  const isRtl = isRtlLocale(locale);
  const dict = useDictionary();
  const tNav = dict?.nav ?? {};
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [userIsAdmin, setUserIsAdmin] = useState(false);

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
        className={`fixed top-0 z-[100] h-[100dvh] w-[85vw] max-w-sm bg-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col ${
          isRtl ? "right-0" : "left-0"
        } ${
          isOpen
            ? "translate-x-0"
            : isRtl
            ? "translate-x-[100%]"
            : "-translate-x-[100%]"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-zinc-100 shrink-0">
          <button
            className="p-2 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 transition-all duration-200"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <XIcon className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold tracking-tight">{dict?.common?.store_name ?? "My Store"}</span>
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
                <Link href={`/${locale}/orders`} onClick={onClose} className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
                  <ClipboardList className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span>{tNav.my_orders ?? "My Orders"}</span>
                </Link>
                <Link href={`/${locale}/favorites`} onClick={onClose} className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
                  <Heart className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span>{tNav.favorites ?? "Favorites"}</span>
                </Link>
                <Link href={`/${locale}/categories`} onClick={onClose} className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
                  <LayoutGrid className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span>{tNav.categories ?? "Categories"}</span>
                </Link>
                <Link href={`/${locale}/account`} onClick={onClose} className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
                  <UserIcon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span>{tNav.account_settings ?? "Account Settings"}</span>
                </Link>
                {userIsAdmin && (
                  <Link
                    href={`/${locale}/admin`}
                    onClick={onClose}
                    className="flex items-center gap-4 mt-1 mx-0 px-4 py-3 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 active:scale-[0.98] transition-all shadow-sm"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15">
                      <Settings2 className="h-4 w-4 shrink-0" strokeWidth={2} />
                    </span>
                    <span className="flex-1">{tNav.dashboard ?? "Dashboard"}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                      Admin
                    </span>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            /* ── Guest: Categories only ── */
            <nav className="flex flex-col py-4">
              {[{ href: `/${locale}/categories`, label: tNav.categories ?? "Categories", Icon: LayoutGrid }].map((linkItem, idx) => {
                const Chevron = isRtl ? ChevronLeft : ChevronRight;
                return (
                  <Link
                    key={linkItem.href}
                    href={linkItem.href}
                    onClick={onClose}
                    className={`group flex items-center gap-4 px-5 py-3.5 text-base font-medium text-zinc-800 hover:bg-zinc-50 hover:text-zinc-900 transition-all duration-500 ease-out transform ${
                      isOpen ? "translate-x-0 opacity-100" : isRtl ? "translate-x-8 opacity-0" : "-translate-x-8 opacity-0"
                    }`}
                    style={{ transitionDelay: `${isOpen ? idx * 60 + 120 : 0}ms` }}
                  >
                    <linkItem.Icon className="h-5 w-5 text-zinc-400 group-hover:text-zinc-900 transition-colors shrink-0" strokeWidth={1.5} />
                    <span className="flex-1">{linkItem.label}</span>
                    <Chevron className="h-4 w-4 text-zinc-300 group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex-1" />

          {/* ── Bottom: About, Privacy, Contact ── */}
          <nav className="flex flex-col border-t border-zinc-100 py-2">
            {bottomLinks.map((linkItem, idx) => {
              const Chevron = isRtl ? ChevronLeft : ChevronRight;
              return (
                <Link
                  key={linkItem.href}
                  href={linkItem.href}
                  onClick={onClose}
                  className={`group flex items-center gap-4 px-5 py-3.5 text-base font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all duration-500 ease-out transform ${
                    isOpen ? "translate-x-0 opacity-100" : isRtl ? "translate-x-8 opacity-0" : "-translate-x-8 opacity-0"
                  }`}
                  style={{ transitionDelay: `${isOpen ? idx * 50 + 300 : 0}ms` }}
                >
                  <linkItem.Icon className="h-5 w-5 text-zinc-400 group-hover:text-zinc-700 transition-colors shrink-0" strokeWidth={1.5} />
                  <span className="flex-1">{linkItem.label}</span>
                  <Chevron className="h-4 w-4 text-zinc-300 group-hover:text-zinc-600 transition-all" />
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-zinc-100 shrink-0">
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
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 transition-colors active:scale-95"
                  onClick={onClose}
                >
                  <UserIcon className="h-4 w-4" />
                  <span>{tNav.login}</span>
                </Link>
                <Link
                  href={`/${locale}/signup`}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white shadow-md hover:bg-zinc-800 transition-colors active:scale-95"
                  onClick={onClose}
                >
                  {tNav.signup}
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
                  <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span>{tNav.logout}</span>
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
