"use client";

import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";

export default function ShopFooter() {
  const dict = useDictionary();
  const { dir } = useLocale();
  const tFooter = dict?.footer ?? {};
  const isRtl = dir === "rtl";

  return (
    <footer className="relative bg-zinc-950 text-zinc-100">
      {/* ── Wave divider ── */}
      <div className="w-full overflow-hidden leading-none" aria-hidden="true">
        <svg
          viewBox="0 0 1440 64"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="w-full h-12 md:h-16 block"
        >
          <path
            d="M0,32 C240,64 480,0 720,32 C960,64 1200,0 1440,32 L1440,0 L0,0 Z"
            fill="white"
          />
        </svg>
      </div>

      {/* ── Footer content ── */}
      <div className="px-6 pb-12 pt-4">
        <div className={`mx-auto max-w-7xl grid gap-8 md:grid-cols-3 items-start mb-12 ${isRtl ? "text-right" : "text-left"}`}>
          <div>
            <div className="text-2xl font-bold tracking-tighter mb-4 text-white">My store</div>
            <p className={`text-sm text-zinc-400 max-w-xs ${isRtl ? "ms-auto md:ms-0" : ""}`}>{tFooter.tagline}</p>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold text-white">{tFooter.shop_heading}</h4>
            <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{tFooter.shop_all}</a>
            <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{tFooter.shop_featured}</a>
            <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{tFooter.shop_new}</a>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold text-white">{tFooter.support_heading}</h4>
            <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{tFooter.faq}</a>
            <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{tFooter.shipping_returns}</a>
            <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{tFooter.contact}</a>
          </div>
        </div>

        <div className="mx-auto max-w-7xl border-t border-zinc-800 pt-6 text-center">
          <p className="text-sm text-zinc-500">{tFooter.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
