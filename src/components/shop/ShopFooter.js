"use client";

import Image from "next/image";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";
import { WHATSAPP_NUMBER, INSTAGRAM_HANDLE } from "@/config/constants";

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
            <Image src="/images/shop-logo-white.png" alt="LaCérémonie" width={180} height={45} className="h-6 w-auto object-contain mb-4" />
            <p className={`text-sm text-zinc-400 max-w-xs ${isRtl ? "ms-auto md:ms-0" : ""}`}>{tFooter.tagline}</p>
            {/* Social links */}
            <div className={`flex gap-3 mt-5 ${isRtl ? "justify-end md:justify-start" : ""}`}>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:bg-green-600 hover:text-white transition-colors"
              >
                {/* WhatsApp SVG */}
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.103 1.508 5.829L.057 23.5l5.802-1.429A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.576-.5-5.065-1.373l-.363-.214-3.441.847.873-3.348-.236-.386A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
              </a>
              <a
                href={`https://instagram.com/${INSTAGRAM_HANDLE}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:bg-pink-600 hover:text-white transition-colors"
              >
                {/* Instagram SVG */}
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </a>
            </div>
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
            <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{tFooter.about_us}</a>
            <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{tFooter.privacy_policy}</a>
          </div>
        </div>

        <div className="mx-auto max-w-7xl border-t border-zinc-800 pt-6 text-center">
          <p className="text-sm text-zinc-500">{tFooter.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
