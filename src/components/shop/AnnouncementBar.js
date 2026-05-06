"use client";

/**
 * AnnouncementBar — global promo / announcement banner.
 *
 * - Reads active announcements from /api/v1/announcements (cached SWR-style).
 * - Filters by scope (home_only vs. all pages) using current pathname.
 * - Filters by start/end schedule on the client (defense-in-depth).
 * - Auto-rotates messages when carousel is enabled.
 * - Supports: promotion (with copy promo code), shipping, limited (countdown),
 *   social (WhatsApp/Instagram links), notification.
 * - Dismissible (per announcement, persisted to localStorage).
 * - No layout shift: renders nothing until data is known. Once visible,
 *   uses a fixed-min-height row at the top/bottom.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  X,
  Copy,
  Check,
  Megaphone,
  Truck,
  Clock,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const DISMISS_KEY = "estore-announcements-dismissed";

// Module-level cache: persists across client navigations, cleared on hard refresh
let _cache = null;

/** Call this after any admin change so the bar re-fetches on next render. */
export function invalidateBarCache() {
  _cache = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('announcement-cache-invalidated'));
  }
}

/* ────────────────── Real brand SVG icons ────────────────── */
function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}
function InstagramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
}
function TikTokIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
    </svg>
  );
}

const ICONS = {
  megaphone: Megaphone,
  truck: Truck,
  clock: Clock,
  bell: Bell,
  whatsapp: WhatsAppIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
};

const SOCIAL_LINKS = {
  whatsapp:  { label: 'WhatsApp',  Icon: WhatsAppIcon,  hrefFn: (v) => `https://wa.me/${String(v).replace(/[^0-9]/g, '')}` },
  facebook:  { label: 'Facebook',  Icon: FacebookIcon,  hrefFn: (v) => /^https?:/i.test(v) ? v : `https://facebook.com/${v}` },
  instagram: { label: 'Instagram', Icon: InstagramIcon, hrefFn: (v) => /^https?:/i.test(v) ? v : `https://instagram.com/${String(v).replace(/^@/, '')}` },
  tiktok:    { label: 'TikTok',    Icon: TikTokIcon,    hrefFn: (v) => /^https?:/i.test(v) ? v : `https://tiktok.com/@${String(v).replace(/^@/, '')}` },
};

function readDismissed() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(set) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore quota */
  }
}

function isWithinSchedule(a, now = Date.now()) {
  if (a.start_at && new Date(a.start_at).getTime() > now) return false;
  if (a.end_at && new Date(a.end_at).getTime() < now) return false;
  return true;
}

function pathIsHome(pathname) {
  if (!pathname) return false;
  // matches "/", "/en", "/fr", "/ar", "/dr" exactly
  return /^\/(?:en|fr|ar|dr)?\/?$/.test(pathname);
}

function pathIsAdmin(pathname) {
  if (!pathname) return false;
  return /^\/(?:en|fr|ar|dr)\/admin(?:\/|$)/.test(pathname);
}

/* ─────────────────── Countdown sub-component ─────────────────── */
function Countdown({ endAt, labels }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const end = new Date(endAt).getTime();
  const diff = Math.max(0, end - now);
  if (diff === 0) return null;

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  const pad = (n) => String(n).padStart(2, "0");
  const parts = [];
  if (d > 0) parts.push(`${d}${labels?.d ?? "d"}`);
  parts.push(`${pad(h)}${labels?.h ?? "h"}`);
  parts.push(`${pad(m)}${labels?.m ?? "m"}`);
  parts.push(`${pad(s)}${labels?.s ?? "s"}`);

  return (
    <span className="font-mono text-xs sm:text-sm tabular-nums px-2 py-0.5 rounded bg-black/15 ml-2">
      {parts.join(" ")}
    </span>
  );
}

/* ─────────────────── Promo code copy button ─────────────────── */
function PromoCode({ code, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [code]);
  return (
    <button
      type="button"
      onClick={handle}
      className="inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-xs sm:text-sm font-mono font-semibold transition-colors"
      aria-label={label}
    >
      <span className="tracking-wider">{code}</span>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ─────────────────── Single announcement renderer ─────────────────── */
function AnnouncementContent({ a, dict }) {
  // For social type the platform buttons serve as the icon — suppress the generic icon
  const Icon = (a.icon_enabled && a.icon && a.type !== 'social') ? (ICONS[a.icon] ?? null) : null;

  const inner = (
    <span className="inline-flex items-center gap-2 flex-wrap justify-center">
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span style={{ fontSize: a.font_size ? `${a.font_size}px` : undefined }}>
        {a.text}
      </span>

      {a.type === "promotion" && a.promo_code && (
        <PromoCode code={a.promo_code} label={dict?.copy_code ?? "Copy code"} />
      )}

      {a.type === "limited" && a.end_at && (
        <Countdown
          endAt={a.end_at}
          labels={{
            d: dict?.cd_d ?? "d",
            h: dict?.cd_h ?? "h",
            m: dict?.cd_m ?? "m",
            s: dict?.cd_s ?? "s",
          }}
        />
      )}

      {a.type === "social" && (() => {
        const platforms = Array.isArray(a.social_platforms) && a.social_platforms.length
          ? a.social_platforms
          : [
              a.social_whatsapp  && 'whatsapp',
              a.social_facebook  && 'facebook',
              a.social_instagram && 'instagram',
              a.social_tiktok    && 'tiktok',
            ].filter(Boolean);
        return platforms.map((pid) => {
          const link = SOCIAL_LINKS[pid];
          const handle = a[`social_${pid}`];
          if (!link || !handle) return null;
          const Icon = link.Icon;
          return (
            <a
              key={pid}
              href={link.hrefFn(handle)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-xs font-semibold transition-colors"
            >
              <Icon className="h-3.5 w-3.5" /> {link.label}
            </a>
          );
        });
      })()}

      {a.cta_text && a.cta_href && a.type !== "social" && (
        <Link
          href={a.cta_href}
          className="inline-flex items-center gap-1 ml-2 px-3 py-0.5 rounded font-semibold text-xs sm:text-sm border border-current hover:bg-white/20 transition-colors"
        >
          {a.cta_text}
        </Link>
      )}
    </span>
  );

  return inner;
}

/* ─────────────────── Main component ─────────────────── */
export default function AnnouncementBar() {
  const pathname = usePathname();
  const [items, setItems] = useState(() => _cache);
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [activeIdx, setActiveIdx] = useState(0);
  const [tick, setTick] = useState(0); // forces re-eval of schedule every minute
  const rotationRef = useRef(null);

  // Fetch (with module cache)
  const [fetchTick, setFetchTick] = useState(0);

  // Re-fetch whenever the admin invalidates the cache
  useEffect(() => {
    const handler = () => setFetchTick((n) => n + 1);
    window.addEventListener('announcement-cache-invalidated', handler);
    return () => window.removeEventListener('announcement-cache-invalidated', handler);
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    fetch("/api/v1/announcements", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return;
        const data = json?.success ? (json.data ?? []) : [];
        _cache = data;
        setItems(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [fetchTick]);

  // Re-evaluate scheduling every 60s (for limited offers expiring while page open)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Visible list: scope filter + schedule + dismissed
  const visible = useMemo(() => {
    if (!items || items.length === 0) return [];
    if (pathIsAdmin(pathname)) return [];
    const onHome = pathIsHome(pathname);
    const now = Date.now();
    return items
      .filter((a) => a.is_active !== false)
      .filter((a) => (a.scope === "home" ? onHome : true))
      .filter((a) => isWithinSchedule(a, now))
      .filter((a) => !dismissed.has(a.id));
    // tick included via ref; re-runs when schedule re-eval interval fires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, pathname, dismissed, tick]);

  // Auto-rotate carousel
  useEffect(() => {
    if (rotationRef.current) clearInterval(rotationRef.current);
    if (visible.length <= 1) return;
    const carouselOnes = visible.filter((a) => a.carousel_enabled);
    // Use the longest interval among the rotating items, default 5s
    const interval =
      Math.max(...visible.map((a) => Number(a.rotation_seconds) || 0), 5) * 1000;
    if (carouselOnes.length === 0 && visible.length > 1) {
      // Even without explicit carousel flag, rotate when multiple items exist.
      rotationRef.current = setInterval(() => {
        setActiveIdx((i) => (i + 1) % visible.length);
      }, interval);
    } else if (carouselOnes.length > 0) {
      rotationRef.current = setInterval(() => {
        setActiveIdx((i) => (i + 1) % visible.length);
      }, interval);
    }
    return () => {
      if (rotationRef.current) clearInterval(rotationRef.current);
    };
  }, [visible]);

  // Clamp index when list shrinks
  useEffect(() => {
    if (activeIdx >= visible.length) setActiveIdx(0);
  }, [visible.length, activeIdx]);

  // Sync --bar-height CSS variable so the header knows how far to offset.
  // - Sticky+top: offset by the bar's full height (constant).
  // - Static+top: offset by the bar's *visible* height as the user scrolls
  //   (bar bottom edge clamped to viewport), so the header eases back to
  //   top: 0 once the bar has scrolled out of view.
  const barRef = useRef(null);
  useEffect(() => {
    const el = barRef.current;
    const root = document.documentElement;
    if (!el || visible.length === 0) {
      root.style.removeProperty('--bar-height');
      return;
    }
    const current = visible[activeIdx] ?? visible[0];
    const positionTop = (current?.position ?? 'top') === 'top';
    const sticky = current?.behavior === 'sticky' || !current?.behavior;

    if (!positionTop) {
      root.style.removeProperty('--bar-height');
      return;
    }

    const setOffset = (px) => root.style.setProperty('--bar-height', `${Math.max(0, px)}px`);

    if (sticky) {
      const update = () => setOffset(el.offsetHeight);
      update();
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
      ro?.observe(el);
      return () => { ro?.disconnect(); root.style.removeProperty('--bar-height'); };
    }

    // Static + top: track how much of the bar is still above the viewport top.
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      // visible portion below y=0 (i.e. how far the header should be pushed down)
      setOffset(Math.min(rect.bottom, el.offsetHeight));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      root.style.removeProperty('--bar-height');
    };
  }, [visible, activeIdx]);

  // Clear on unmount
  useEffect(() => {
    return () => document.documentElement.style.removeProperty('--bar-height');
  }, []);

  if (!items || visible.length === 0) return null;

  const current = visible[activeIdx] ?? visible[0];
  const isSticky = current.behavior === "sticky";
  const positionTop = (current.position ?? "top") === "top";

  const handleDismiss = (id) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    writeDismissed(next);
  };

  const goPrev = () =>
    setActiveIdx((i) => (i - 1 + visible.length) % visible.length);
  const goNext = () => setActiveIdx((i) => (i + 1) % visible.length);

  // Position classes
  const positionClass = positionTop ? "top-0" : "bottom-0";
  const stickyClass = isSticky
    ? `fixed inset-x-0 ${positionClass} z-[51]`
    : `relative w-full z-[51]`;

  const borderClass = current.border_enabled
    ? positionTop
      ? "border-b border-black/10"
      : "border-t border-black/10"
    : "";

  return (
    <div
      ref={barRef}
      role="region"
      aria-label="Site announcement"
      className={`${stickyClass} ${borderClass} transition-colors duration-300`}
      style={{
        backgroundColor: current.bg_color || "#111111",
        color: current.text_color || "#ffffff",
        // Reserve space for content; min height prevents CLS
        minHeight: "2.25rem",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 sm:px-6 py-2 text-sm">
        {visible.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous announcement"
            className="hidden sm:inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15 transition-colors shrink-0"
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
        )}

        <div className="flex-1 min-w-0 text-center">
          <AnnouncementContent a={current} />
        </div>

        {visible.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next announcement"
            className="hidden sm:inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15 transition-colors shrink-0"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        )}

        {current.dismissible !== false && (
          <button
            type="button"
            onClick={() => handleDismiss(current.id)}
            aria-label="Dismiss"
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
