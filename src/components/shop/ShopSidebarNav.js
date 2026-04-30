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
  LayoutDashboard,
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

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) setUser(session.user);
    };
    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          setUser(session?.user || null);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
        }
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const navLinks = [
    { href: `/${locale}`, label: tNav.home, Icon: HomeIcon },
    { href: `/${locale}/shop`, label: tNav.shop, Icon: ShoppingBag },
    { href: `/${locale}/categories`, label: tNav.categories, Icon: LayoutGrid },
    { href: `/${locale}/about`, label: tNav.about, Icon: Info },
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
          <span className="text-lg font-bold tracking-tight">My store</span>
        </div>

        <div className="flex flex-col flex-1 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <nav className="flex flex-col py-4">
            {navLinks.map((linkItem, idx) => {
              const Chevron = isRtl ? ChevronLeft : ChevronRight;
              return (
                <Link
                  key={linkItem.href}
                  href={linkItem.href}
                  onClick={onClose}
                  className={`group flex items-center gap-4 px-5 py-3.5 text-base font-medium text-zinc-800 hover:bg-zinc-50 hover:text-zinc-900 transition-all duration-500 ease-out transform ${
                    isOpen
                      ? "translate-x-0 opacity-100"
                      : isRtl
                      ? "translate-x-8 opacity-0"
                      : "-translate-x-8 opacity-0"
                  }`}
                  style={{ transitionDelay: `${isOpen ? idx * 60 + 120 : 0}ms` }}
                >
                  <linkItem.Icon
                    className="h-5 w-5 text-zinc-400 group-hover:text-zinc-900 transition-colors shrink-0"
                    strokeWidth={1.5}
                  />
                  <span className="flex-1">{linkItem.label}</span>
                  <Chevron className="h-4 w-4 text-zinc-300 group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </nav>

          {user && (
            <div
              className={`mx-5 mb-4 transition-all duration-500 ease-out transform ${
                isOpen
                  ? "translate-y-0 opacity-100"
                  : "translate-y-6 opacity-0"
              }`}
              style={{ transitionDelay: `${isOpen ? 280 : 0}ms` }}
            >
              <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-3 border border-zinc-100">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold uppercase">
                  {(user.user_metadata?.full_name || user.email || "U").charAt(0)}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-zinc-900 truncate">
                    {user.user_metadata?.full_name || tNav.my_account}
                  </span>
                  <span className="text-xs text-zinc-500 truncate">
                    {user.email}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-col">
                <Link
                  href={`/${locale}/admin`}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>{tNav.dashboard}</span>
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    onClose();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>{tNav.logout}</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex-1" />

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
