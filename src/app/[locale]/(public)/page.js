"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Headset, 
  RefreshCcw, 
  Truck, 
  Rocket,
  LogOut,
  User as UserIcon
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import { useDictionary } from "@/components/providers/LocaleProvider";

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale || "en";
  const supabase = createClient();
  const dict = useDictionary();
  const tNav = dict?.nav ?? {};
  const tHome = dict?.home ?? {};
  const tPerks = dict?.perks ?? {};
  const tFooter = dict?.footer ?? {};
  const isRtl = ["ar", "dr"].includes(locale);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      }
    };

    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          setUser(session?.user || null);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const products = [
    { id: 1, name: "Premium Wireless Headphones", price: "$299", category: "Electronics", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop", badge: "New" },
    { id: 2, name: "Minimalist Watch", price: "$129", category: "Accessories", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop" },
    { id: 3, name: "Smart Fitness Tracker", price: "$89", category: "Electronics", image: "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?q=80&w=800&auto=format&fit=crop", badge: "-15%" },
    { id: 4, name: "Ergonomic Mechanical Keyboard", price: "$150", category: "Computing", image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=800&auto=format&fit=crop" },
    { id: 5, name: "Leather Messenger Bag", price: "$199", category: "Accessories", image: "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?q=80&w=800&auto=format&fit=crop" },
    { id: 6, name: "Noise-cancelling Earbuds", price: "$149", category: "Electronics", image: "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?q=80&w=800&auto=format&fit=crop", badge: "Hot" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900">
      
      {/* OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* SIDEBAR */}
      <div 
        className={`fixed top-0 z-[100] h-[100dvh] w-72 md:w-80 bg-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col ${
          isRtl ? "right-0" : "left-0"
        } ${
          isSidebarOpen
            ? "translate-x-0"
            : isRtl ? "translate-x-[100%]" : "-translate-x-[100%]"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-zinc-200 shrink-0">
          <span className="text-xl font-bold tracking-tighter">E-STORE.</span>
          <button 
            className="p-2 -mr-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 hover:rotate-90 active:scale-95 rounded-full transition-all duration-200"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col py-6 px-6 gap-6 overflow-y-auto flex-1">
          <Link href={`/${locale}`} onClick={() => setIsSidebarOpen(false)} className="text-lg font-medium text-zinc-900 hover:text-blue-600 transition-colors">{tNav.home}</Link>
          <Link href={`/${locale}/shop`} onClick={() => setIsSidebarOpen(false)} className="text-lg font-medium text-zinc-600 hover:text-blue-600 transition-colors">{tNav.shop}</Link>
          <Link href={`/${locale}/categories`} onClick={() => setIsSidebarOpen(false)} className="text-lg font-medium text-zinc-600 hover:text-blue-600 transition-colors">{tNav.categories}</Link>
          <Link href={`/${locale}/about`} onClick={() => setIsSidebarOpen(false)} className="text-lg font-medium text-zinc-600 hover:text-blue-600 transition-colors">{tNav.about}</Link>

          <div className="mt-2 border-t border-zinc-200 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{dict?.common?.language}</p>
            <LocaleSwitcher align="left" />
          </div>
          <div className="mt-6 border-t border-zinc-200 pt-6">
            {!user ? (
              <>
                <Link href={`/${locale}/login`} className="text-sm font-medium text-zinc-600 hover:text-blue-600 transition-colors flex items-center gap-2 mb-4" onClick={() => setIsSidebarOpen(false)}>
                  <UserIcon className="h-4 w-4" />
                  {tNav.login}
                </Link>
                <Link href={`/${locale}/signup`} className="text-sm font-medium text-zinc-600 hover:text-blue-600 transition-colors flex items-center gap-2" onClick={() => setIsSidebarOpen(false)}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[10px] text-zinc-600 font-bold">+</span>
                  {tNav.signup}
                </Link>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-4 border border-zinc-100">
                  <div className="flex flex-col text-sm">
                    <span className="font-semibold text-zinc-900">{user.user_metadata?.full_name || tNav.my_account}</span>
                    <span className="text-zinc-500 truncate max-w-[150px] text-xs">{user.email}</span>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold uppercase shrink-0">
                    {(user.user_metadata?.full_name || 'U').charAt(0)}
                  </div>
                </div>
                
                <Link href={`/${locale}/admin`} className="text-sm font-medium text-zinc-600 hover:text-blue-600 transition-colors flex items-center gap-2" onClick={() => setIsSidebarOpen(false)}>
                  {tNav.dashboard}
                </Link>

                <button 
                  onClick={() => {
                    handleLogout();
                    setIsSidebarOpen(false);
                  }}
                  className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors w-full flex items-center gap-2 justify-start pt-2"
                >
                  <LogOut className="h-4 w-4" />
                  {tNav.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button 
              className="p-2 -ml-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 rounded-full hover:scale-110 active:scale-95 transition-all duration-200" 
              aria-label="Open sidebar"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <Link href={`/${locale}`} className="text-2xl font-bold tracking-tighter sm:block">E-STORE.</Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search bar */}
            <div className={`hidden sm:flex items-center transition-all duration-300 ${isSearchOpen ? "w-56 md:w-72" : "w-9"}`}>
              {isSearchOpen ? (
                <div className="flex w-full items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 ring-1 ring-zinc-900/5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4 shrink-0 text-zinc-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && (setIsSearchOpen(false), setSearchQuery(""))}
                    placeholder="Search products…"
                    className="flex-1 bg-transparent text-sm text-zinc-800 placeholder-zinc-400 outline-none"
                  />
                  <button
                    onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }}
                    className="shrink-0 text-zinc-400 hover:text-zinc-700 transition-colors"
                    aria-label="Close search"
                  >
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3 w-3">
                      <path d="M2 2l8 8M10 2l-8 8" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                  aria-label="Open search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </button>
              )}
            </div>
            <LocaleSwitcher />
            <button className="relative p-2 text-zinc-600 hover:text-zinc-900" aria-label="Cart">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                0
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden bg-gradient-to-b from-zinc-50 via-white to-white">
          {/* Animated background blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-200/50 blur-3xl animate-blob" />
            <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-purple-200/50 blur-3xl animate-blob delay-500" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-pink-200/40 blur-3xl animate-blob delay-300" />
            {/* subtle grid */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28 lg:py-32">
            {/* COPY */}
            <div className="flex flex-col items-start gap-6">
              <h1 className="animate-fade-up text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                {tHome.title_part1}{" "}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                    {tHome.title_highlight}
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 200 12"
                    className="absolute -bottom-2 left-0 h-3 w-full text-blue-300"
                  >
                    <path
                      d="M0 6 Q 50 0, 100 6 T 200 6"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>{" "}
                {tHome.title_part2}
              </h1>

              <p className="animate-fade-up text-base text-zinc-500 sm:text-lg max-w-md">
                {tHome.subtitle}
              </p>

              <div className="animate-fade-up delay-500 flex flex-wrap items-center gap-3">
                <Link
                  href={`/${locale}/shop`}
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-zinc-900 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-900/30 active:scale-95 sm:text-base"
                >
                  <span className="relative z-10">{tHome.cta_shop}</span>
                  <svg
                    className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                </Link>
                <a
                  href="#featured"
                  className="rounded-full border border-zinc-200 bg-white px-7 py-3.5 text-sm font-semibold text-zinc-900 transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-95 sm:text-base"
                >
                  {tHome.cta_browse}
                </a>
              </div>

              {/* Mobile search bar — hidden on sm+ (header handles it there) */}
              <div className="sm:hidden w-full animate-fade-up">
                <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2.5 shadow-sm ring-1 ring-zinc-900/5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4 shrink-0 text-zinc-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search products…"
                    className="flex-1 bg-transparent text-sm text-zinc-800 placeholder-zinc-400 outline-none"
                  />
                  <button className="shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-zinc-700">
                    Go
                  </button>
                </div>
              </div>

              {/* trust strip */}
              <div className="animate-fade-up delay-700 mt-4 flex items-center gap-6">
                <div className="flex -space-x-2">
                  {[
                    "https://i.pravatar.cc/40?img=1",
                    "https://i.pravatar.cc/40?img=5",
                    "https://i.pravatar.cc/40?img=8",
                    "https://i.pravatar.cc/40?img=12",
                  ].map((src) => (
                    <img
                      key={src}
                      src={src}
                      alt=""
                      className="h-8 w-8 rounded-full border-2 border-white object-cover"
                    />
                  ))}
                </div>
                <div className="text-xs text-zinc-600 sm:text-sm">
                  <div className="flex items-center gap-1 font-semibold text-zinc-900">
                    <span className="text-amber-500">★★★★★</span>
                    <span>4.9</span>
                  </div>
                  <span>{tHome.trust_loved}</span>
                </div>
              </div>
            </div>

            {/* ANIMATED PRODUCT SHOWCASE */}
            <div className="relative mx-auto w-full max-w-md md:max-w-none">
              <div className="relative aspect-[4/5] w-full">
                {/* gradient backdrop */}
                <div className="absolute inset-0 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-blue-100 via-indigo-100 to-purple-100" />

                {/* main product card */}
                <div className="absolute inset-4 overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-zinc-900/10 transition-transform duration-700 hover:scale-[1.02]">
                  <img
                    src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=900&auto=format&fit=crop"
                    alt="Premium Wireless Headphones"
                    className="h-full w-full object-cover"
                  />
                  {/* gradient overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <p className="text-xs uppercase tracking-widest text-white/70">{tHome.showcase_featured}</p>
                    <p className="mt-1 text-lg font-semibold">{tHome.showcase_product}</p>
                    <p className="text-sm text-white/80">$299.00</p>
                  </div>
                  {/* shimmer sweep */}
                  <div className="pointer-events-none absolute inset-0 bg-shimmer" />
                </div>

                {/* floating mini-card top-left */}
                <div
                  className="absolute -left-3 top-6 flex w-44 items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-xl shadow-zinc-900/10 backdrop-blur animate-float-slow sm:-left-6"
                  style={{ "--tw-rotate": "-4deg", transform: "rotate(-4deg)" }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900">{tHome.showcase_order_placed}</p>
                    <p className="truncate text-[10px] text-zinc-500">{tHome.showcase_just_now}</p>
                  </div>
                </div>

                {/* floating mini-card bottom-right */}
                <div
                  className="absolute -right-3 bottom-10 w-48 rounded-2xl bg-white/95 p-3 shadow-xl shadow-zinc-900/10 backdrop-blur animate-float-fast sm:-right-6"
                  style={{ "--tw-rotate": "5deg", transform: "rotate(5deg)" }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-zinc-900">{tHome.showcase_free_shipping}</p>
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                      24h
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">{tHome.showcase_progress}</p>
                </div>

                {/* floating price tag */}
                <div className="absolute -top-4 right-6 flex h-16 w-16 rotate-12 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg animate-float-slow sm:right-10">
                  <div className="text-center leading-tight">
                    <div className="text-[9px] uppercase tracking-wider text-white/60">{tHome.showcase_save}</div>
                    <div className="text-sm font-bold">30%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* logo marquee */}
          <div className="relative border-t border-zinc-200/70 bg-white/50 py-6 backdrop-blur">
            <div className="mx-auto max-w-7xl overflow-hidden px-6">
              <p className="mb-4 text-center text-xs uppercase tracking-widest text-zinc-400">
                {tHome.brands_label}
              </p>
              <div className="flex">
                <div className="flex shrink-0 animate-marquee items-center gap-12 pr-12 text-zinc-400">
                  {["SONOS", "BOSE", "APPLE", "SAMSUNG", "LG", "PHILIPS", "JBL", "BEATS"].map((b) => (
                    <span key={b} className="text-2xl font-bold tracking-widest opacity-60">
                      {b}
                    </span>
                  ))}
                </div>
                <div
                  aria-hidden="true"
                  className="flex shrink-0 animate-marquee items-center gap-12 pr-12 text-zinc-400"
                >
                  {["SONOS", "BOSE", "APPLE", "SAMSUNG", "LG", "PHILIPS", "JBL", "BEATS"].map((b) => (
                    <span key={b + "-2"} className="text-2xl font-bold tracking-widest opacity-60">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MAIN SECTION: PRODUCT LIST */}
        <section id="featured" className="bg-zinc-50 px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                  {tHome.featured_kicker}
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                  {tHome.featured_title}
                </h2>
              </div>
              <Link
                href={`/${locale}/shop`}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline self-start sm:self-auto"
              >
                <span>{dict?.common?.view_all}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-xl hover:shadow-zinc-900/5"
                >
                  {/* IMAGE */}
                  <div className="relative aspect-square w-full overflow-hidden bg-zinc-100">
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                    />
                    {product.badge && (
                      <span className="absolute left-3 top-3 rounded-full bg-zinc-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                        {product.badge}
                      </span>
                    )}
                    <button
                      aria-label={tHome.wishlist}
                      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow-md backdrop-blur transition-all hover:scale-110 hover:text-red-500"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                    </button>

                    {/* hover quick-add bar */}
                    <div className="absolute inset-x-3 bottom-3 translate-y-12 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <button className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-zinc-800">
                        {tHome.quick_add}
                      </button>
                    </div>
                  </div>

                  {/* INFO */}
                  <div className="flex flex-1 flex-col gap-1 p-4 sm:p-5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      {product.category}
                    </span>
                    <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900 sm:text-base">
                      {product.name}
                    </h3>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-base font-bold text-zinc-900">{product.price}</p>
                      <div className="flex items-center gap-0.5 text-xs text-amber-500">
                        ★★★★★
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PERKS / FEATURES SECTION */}
        <section className="px-6 py-16 bg-white">
          <div className="mx-auto max-w-7xl rounded-xl border border-zinc-100 bg-white p-8">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              
              {/* SUPPORT */}
              <div className="flex items-start gap-4">
                <Headset className="w-8 h-8 text-blue-600 shrink-0" strokeWidth={1} />
                <div>
                  <h3 className="text-base font-medium text-zinc-900">{tPerks.support_title}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{tPerks.support_desc}</p>
                </div>
              </div>

              {/* RETURN */}
              <div className="flex items-start gap-4">
                <RefreshCcw className="w-8 h-8 text-blue-600 shrink-0" strokeWidth={1} />
                <div>
                  <h3 className="text-base font-medium text-zinc-900">{tPerks.return_title}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{tPerks.return_desc}</p>
                </div>
              </div>

              {/* FREE SHIPPING */}
              <div className="flex items-start gap-4">
                <Truck className="w-8 h-8 text-blue-600 shrink-0" strokeWidth={1} />
                <div>
                  <h3 className="text-base font-medium text-zinc-900">{tPerks.free_shipping_title}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{tPerks.free_shipping_desc}</p>
                </div>
              </div>

              {/* EXPRESS DELIVERY */}
              <div className="flex items-start gap-4">
                <Rocket className="w-8 h-8 text-blue-600 shrink-0" strokeWidth={1} />
                <div>
                  <h3 className="text-base font-medium text-zinc-900">{tPerks.express_title}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{tPerks.express_desc}</p>
                </div>
              </div>

            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-200 px-6 py-12 text-center">
        <div className="mx-auto max-w-7xl grid gap-8 md:grid-cols-3 items-start text-left mb-12">
          <div>
            <div className="text-2xl font-bold tracking-tighter mb-4">E-STORE.</div>
            <p className="text-sm text-zinc-500 max-w-xs">{tFooter.tagline}</p>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold">{tFooter.shop_heading}</h4>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">{tFooter.shop_all}</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">{tFooter.shop_featured}</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">{tFooter.shop_new}</a>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold">{tFooter.support_heading}</h4>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">{tFooter.faq}</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">{tFooter.shipping_returns}</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">{tFooter.contact}</a>
          </div>
        </div>
        <p className="text-sm text-zinc-500">
          {tFooter.copyright}
        </p>
      </footer>
    </div>
  );
}
