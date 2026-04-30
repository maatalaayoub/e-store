"use client";

import { useDictionary } from "@/components/providers/LocaleProvider";

export default function ShopFooter() {
  const dict = useDictionary();
  const tFooter = dict?.footer ?? {};

  return (
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
      <p className="text-sm text-zinc-500">{tFooter.copyright}</p>
    </footer>
  );
}
