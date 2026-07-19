"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";

function useFooterSettings() {
  const [settings, setSettings] = useState({ data: null });
  useEffect(() => {
    fetch("/api/v1/display-settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setSettings({ data: json.data });
        }
      })
      .catch(() => {});
  }, []);
  return settings;
}

function SocialIcon({ platform, href, children }) {
  const colors = {
    whatsapp: "hover:bg-green-600",
    instagram: "hover:bg-pink-600",
    facebook: "hover:bg-blue-600",
    tiktok: "hover:bg-zinc-900 hover:ring-1 hover:ring-white/30",
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={platform}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 ${colors[platform] ?? "hover:bg-zinc-700"} hover:text-white transition-colors`}
    >
      {children}
    </a>
  );
}

export default function ShopFooter() {
  const dict = useDictionary();
  const { dir, locale } = useLocale();
  const tFooter = dict?.footer ?? {};
  const isRtl = dir === "rtl";
  const { data: settings } = useFooterSettings();

  const storeName = settings?.store_name ?? tFooter.copyright?.replace?.(/^© \d+\s*/, "") ?? "My store";
  const tagline = settings?.store_description ?? tFooter.tagline;

  const socials = [
    {
      platform: "whatsapp",
      value: settings?.social_whatsapp,
      show: settings?.show_social_whatsapp !== "false",
      href: (v) => `https://wa.me/${v.replace(/\D/g, "")}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.103 1.508 5.829L.057 23.5l5.802-1.429A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.576-.5-5.065-1.373l-.363-.214-3.441.847.873-3.348-.236-.386A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
        </svg>
      ),
    },
    {
      platform: "instagram",
      value: settings?.social_instagram,
      show: settings?.show_social_instagram !== "false",
      href: (v) => `https://instagram.com/${v.replace(/^@/, "")}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
        </svg>
      ),
    },
    {
      platform: "facebook",
      value: settings?.social_facebook,
      show: settings?.show_social_facebook !== "false",
      href: (v) => `https://facebook.com/${v.replace(/^@/, "")}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
    },
    {
      platform: "tiktok",
      value: settings?.social_tiktok,
      show: settings?.show_social_tiktok !== "false",
      href: (v) => `https://tiktok.com/@${v.replace(/^@/, "")}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      ),
    },
  ].filter((s) => s.show && s.value && String(s.value).trim());

  return (
    <footer className="relative bg-zinc-950 text-zinc-100">

      {/* ── Footer content ── */}
      <div className="px-6 pb-12 pt-10">
        <div className={`mx-auto max-w-7xl grid gap-8 md:grid-cols-3 items-start mb-12 ${isRtl ? "text-right" : "text-left"}`}>
          <div>
            {settings?.store_logo_dark ? (
              <Image
                src={settings.store_logo_dark}
                alt={storeName}
                width={Math.min(Math.max(parseInt(settings?.store_logo_size || '160', 10) || 160, 80), 320)}
                height={Math.min(Math.max(parseInt(settings?.store_logo_height || '40', 10) || 40, 20), 120)}
                className="h-auto w-auto max-w-full object-contain mb-4"
                style={{ maxHeight: `${Math.min(Math.max(parseInt(settings?.store_logo_height || '40', 10) || 40, 20), 120)}px` }}
              />
            ) : (
              <div className="h-6 w-32 mb-4" />
            )}
            <p className={`text-sm text-zinc-400 max-w-xs ${isRtl ? "ms-auto md:ms-0" : ""}`}>{tagline}</p>
            {/* Social links */}
            {socials.length > 0 && (
              <div className={`flex gap-3 mt-5 ${isRtl ? "justify-end md:justify-start" : ""}`}>
                {socials.map((s) => (
                  <SocialIcon key={s.platform} platform={s.platform} href={s.href(s.value)}>
                    {s.icon}
                  </SocialIcon>
                ))}
              </div>
            )}
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
            <Link href={`/${locale}/contact`} className="text-sm text-zinc-400 hover:text-white transition-colors">{tFooter.contact}</Link>
            <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{tFooter.about_us}</a>
            <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{tFooter.privacy_policy}</a>
          </div>
        </div>

        <div className="mx-auto max-w-7xl border-t border-zinc-800 pt-6 text-center">
          <p className="text-sm text-zinc-500">© {new Date().getFullYear()} {storeName} {tFooter.copyright?.replace?.(/^© \d+\s*/, "") ?? "All rights reserved."}</p>
        </div>
      </div>
    </footer>
  );
}
