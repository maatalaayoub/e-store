"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { locales, localeMetadata } from "@/i18n/config";
import { switchLocale } from "@/lib/routing/navigation";

/* ─── per-locale display info ─────────────────────────────────
   icon: path relative to /public  (swap these once you drop the files in)
   label: display name shown in the list
────────────────────────────────────────────────────────────── */
const LOCALE_INFO = {
  en: { label: "English",  icon: "/images/usa.png" },
  ar: { label: "العربية",  icon: "/images/saudi-arabia.png" },
  fr: { label: "Français", icon: "/images/french.png" },
  dr: { label: "الدارجة", icon: "/images/morocco.png" },
};

function FlagCircle({ src, code, size = 28 }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={code}
        width={size}
        height={size}
        className="rounded-md object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  /* placeholder until icons are provided */
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md bg-zinc-100 border border-zinc-200 text-[10px] font-bold uppercase text-zinc-500"
      style={{ width: size, height: size }}
    >
      {code.slice(0, 2)}
    </span>
  );
}

export default function LocaleSwitcher({ className = "", align = "right", direction = "down" }) {
  const pathname = usePathname();
  const { locale: current } = useParams();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);

  const currentInfo = LOCALE_INFO[current] ?? LOCALE_INFO.en;
  const currentMeta = localeMetadata[current] ?? localeMetadata.en;
  const isRtl = currentMeta.dir === "rtl";
  const anchor =
    align === "right"
      ? isRtl ? "left-0" : "right-0"
      : isRtl ? "right-0" : "left-0";

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>

      {/* ── Trigger ── */}
      <button
        dir="ltr"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 bg-transparent pl-1.5 pr-2 transition"
      >
        <FlagCircle src={currentInfo.icon} code={current} size={24} />
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-700">
          {current}
        </span>
        <svg
          viewBox="0 0 10 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-2.5 w-2.5 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          dir="ltr"
          role="listbox"
          className={`locale-dropdown absolute ${anchor} ${direction === "up" ? "bottom-full mb-2" : "mt-2"} z-[200] w-52 overflow-hidden border border-zinc-100 bg-white py-1.5 shadow-xl`}
          style={{ borderRadius: '5px' }}
        >
          {locales.map((code) => {
            const meta = localeMetadata[code];
            const info = LOCALE_INFO[code];
            const href = switchLocale(pathname, code);
            const isActive = code === current;

            return (
              <Link
                key={code}
                href={href}
                role="option"
                aria-selected={isActive}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                  isActive
                    ? "bg-zinc-50"
                    : "hover:bg-zinc-50"
                }`}
              >
                <FlagCircle src={info.icon} code={code} size={28} />
                <span
                  className={`flex-1 text-sm ${
                    isActive ? "font-semibold text-zinc-900" : "font-medium text-zinc-700"
                  }`}
                  style={(code === "ar" || code === "dr") ? { fontFamily: "var(--font-cairo), Arial, sans-serif" } : undefined}
                >
                  {info.label}
                </span>
                {isActive && (
                  <svg
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                  >
                    <path d="M2 7l4 4 6-6" />
                  </svg>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}


