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

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale || "en";
  const supabase = createClient();

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
    { id: 1, name: "Premium Wireless Headphones", price: "$299", category: "Electronics" },
    { id: 2, name: "Minimalist Watch", price: "$129", category: "Accessories" },
    { id: 3, name: "Smart Fitness Tracker", price: "$89", category: "Electronics" },
    { id: 4, name: "Ergonomic Mechanical Keyboard", price: "$150", category: "Computing" },
    { id: 5, name: "Leather Messenger Bag", price: "$199", category: "Accessories" },
    { id: 6, name: "Noise-cancelling Earbuds", price: "$149", category: "Electronics" },
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
        className={`fixed top-0 left-0 z-[100] h-[100dvh] w-72 md:w-80 bg-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-[100%]"}`}
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
          <Link href={`/${locale}`} onClick={() => setIsSidebarOpen(false)} className="text-lg font-medium text-zinc-900 hover:text-blue-600 transition-colors">Home</Link>
          <Link href={`/${locale}/shop`} onClick={() => setIsSidebarOpen(false)} className="text-lg font-medium text-zinc-600 hover:text-blue-600 transition-colors">Shop</Link>
          <Link href={`/${locale}/categories`} onClick={() => setIsSidebarOpen(false)} className="text-lg font-medium text-zinc-600 hover:text-blue-600 transition-colors">Categories</Link>
          <Link href={`/${locale}/about`} onClick={() => setIsSidebarOpen(false)} className="text-lg font-medium text-zinc-600 hover:text-blue-600 transition-colors">About Us</Link>
          <div className="mt-6 border-t border-zinc-200 pt-6">
            {!user ? (
              <>
                <Link href={`/${locale}/login`} className="text-sm font-medium text-zinc-600 hover:text-blue-600 transition-colors flex items-center gap-2 mb-4" onClick={() => setIsSidebarOpen(false)}>
                  <UserIcon className="h-4 w-4" />
                  Log in
                </Link>
                <Link href={`/${locale}/signup`} className="text-sm font-medium text-zinc-600 hover:text-blue-600 transition-colors flex items-center gap-2" onClick={() => setIsSidebarOpen(false)}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[10px] text-zinc-600 font-bold">+</span>
                  Create account
                </Link>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-4 border border-zinc-100">
                  <div className="flex flex-col text-sm">
                    <span className="font-semibold text-zinc-900">{user.user_metadata?.full_name || 'My Account'}</span>
                    <span className="text-zinc-500 truncate max-w-[150px] text-xs">{user.email}</span>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold uppercase shrink-0">
                    {(user.user_metadata?.full_name || 'U').charAt(0)}
                  </div>
                </div>
                
                <Link href={`/${locale}/admin`} className="text-sm font-medium text-zinc-600 hover:text-blue-600 transition-colors flex items-center gap-2" onClick={() => setIsSidebarOpen(false)}>
                  Dashboard
                </Link>

                <button 
                  onClick={() => {
                    handleLogout();
                    setIsSidebarOpen(false);
                  }}
                  className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors w-full flex items-center gap-2 justify-start pt-2"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
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

          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-600 hover:text-zinc-900 hidden sm:block" aria-label="Search">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
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
        <section className="relative overflow-hidden px-6 py-24 md:py-32">
          <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2 md:items-center">
            <div className="flex flex-col items-start gap-6">
              <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium">
                🚀 New Summer Collection 2026
              </div>
              <h1 className="text-5xl font-extrabold tracking-tight md:text-7xl">
                Redefine your <br className="hidden md:block"/> everyday style.
              </h1>
              <p className="max-w-md text-lg text-zinc-500">
                Discover the most premium products curated just for you. Quality materials and minimalist design combined.
              </p>
              <button className="rounded-full bg-blue-600 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-blue-700 hover:scale-105 active:scale-95">
                Shop Now
              </button>
            </div>

            {/* HERO PHOTO CARD WITH ANIMATION */}
            <div className="relative group perspective-1000">
              <div className="relative z-10 w-full overflow-hidden rounded-3xl border border-zinc-100 bg-zinc-100 aspect-[4/5] object-cover transition-all duration-700 ease-out group-hover:-translate-y-4 group-hover:rotate-2">
                <img 
                  src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop" 
                  alt="Hero Product" 
                  className="h-full w-full object-cover mix-blend-multiply"
                />
              </div>
              <div className="absolute -inset-4 z-0 rounded-3xl bg-gradient-to-tr from-blue-100 to-purple-100 opacity-50 blur-2xl transition-all duration-700 group-hover:opacity-100 group-hover:scale-105"></div>
            </div>
          </div>
        </section>

        {/* MAIN SECTION: PRODUCT LIST */}
        <section className="bg-zinc-50 px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 flex items-center justify-between">
              <h2 className="text-3xl font-bold tracking-tight">Featured Products</h2>
              <a href="#" className="text-sm font-medium text-blue-600 hover:underline">View all &rarr;</a>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <div 
                  key={product.id} 
                  className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300"
                >
                  <div className="mb-6 aspect-square w-full overflow-hidden rounded-xl bg-zinc-100 flex items-center justify-center">
                    {/* Placeholder for Product Image */}
                    <span className="text-4xl text-zinc-300">📦</span>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {product.category}
                    </div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="font-medium text-zinc-600">{product.price}</p>
                    </div>
                  </div>
                  <button className="mt-6 w-full rounded-xl bg-zinc-100 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200">
                    Add to Cart
                  </button>
                </div>
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
                  <h3 className="text-base font-medium text-zinc-900">Assistance technique 24h/24 et 7j/7</h3>
                  <p className="text-sm text-zinc-500 mt-1">Le support est disponible toute la semaine de 9h à 22h</p>
                </div>
              </div>

              {/* RETURN */}
              <div className="flex items-start gap-4">
                <RefreshCcw className="w-8 h-8 text-blue-600 shrink-0" strokeWidth={1} />
                <div>
                  <h3 className="text-base font-medium text-zinc-900">Échange et retour</h3>
                  <p className="text-sm text-zinc-500 mt-1">Échange et retour</p>
                </div>
              </div>

              {/* FREE SHIPPING */}
              <div className="flex items-start gap-4">
                <Truck className="w-8 h-8 text-blue-600 shrink-0" strokeWidth={1} />
                <div>
                  <h3 className="text-base font-medium text-zinc-900">FREE SHIPPING</h3>
                  <p className="text-sm text-zinc-500 mt-1">Free Shipping on all orders from the US or orders of $ 99 or more.</p>
                </div>
              </div>

              {/* EXPRESS DELIVERY */}
              <div className="flex items-start gap-4">
                <Rocket className="w-8 h-8 text-blue-600 shrink-0" strokeWidth={1} />
                <div>
                  <h3 className="text-base font-medium text-zinc-900">Livraison express</h3>
                  <p className="text-sm text-zinc-500 mt-1">Livraison rapide et gratuite dans toutes les villes du Royaume</p>
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
            <p className="text-sm text-zinc-500 max-w-xs">High-quality products for your everyday life. Est. 2026.</p>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold">Shop</h4>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">All Products</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">Featured</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">New Arrivals</a>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold">Support</h4>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">FAQ</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">Shipping & Returns</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900">Contact Us</a>
          </div>
        </div>
        <p className="text-sm text-zinc-500">
          &copy; 2026 E-Store. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
