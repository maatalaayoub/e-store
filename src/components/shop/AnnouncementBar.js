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
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";
import { resolveAnnouncementTranslation } from "@/lib/announcement-locale";
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
const DISMISS_TTL_DAYS = 30;

// Module-level cache: persists across client navigations, cleared on hard refresh
let _cache = null;
let _fetchSeq = 0; // monotonically increasing — guards against out-of-order fetches

/** Allowed CTA href schemes (defense in depth — server also validates) */
const SAFE_HREF_RE = /^(?:https?:\/\/|\/|#|mailto:|tel:)/i;
function safeHref(href) {
  if (!href) return null;
  const s = String(href).trim();
  return SAFE_HREF_RE.test(s) ? s : null;
}

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
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const ttl = DISMISS_TTL_DAYS * 24 * 60 * 60 * 1000;
    // Backwards compat: old format was a plain array of IDs.
    if (Array.isArray(parsed)) return new Map(parsed.map((id) => [id, now]));
    if (parsed && typeof parsed === 'object') {
      return new Map(
        Object.entries(parsed).filter(([, ts]) => Number(ts) && (now - Number(ts)) < ttl),
      );
    }
    return new Map();
  } catch {
    return new Map();
  }
}

function writeDismissed(map) {
  if (typeof window === "undefined") return;
  try {
    const obj = Object.fromEntries(map);
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(obj));
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
export function Countdown({ endAt, labels, expiredLabel }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const end = new Date(endAt).getTime();
  if (!Number.isFinite(end)) return null;
  const diff = Math.max(0, end - now);
  const isExpired = diff === 0;

  if (isExpired) {
    return (
      <span
        className="inline-flex items-center justify-center px-2 py-0.5 rounded border border-current/35 bg-black/10 text-[10px] uppercase tracking-wide font-semibold ml-3"
        aria-live="polite"
      >
        {expiredLabel ?? 'Expired'}
      </span>
    );
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  const pad = (n) => String(n).padStart(2, "0");
  const units = [];
  if (d > 0) units.push({ v: d,      l: labels?.d ?? 'd' });
  units.push(          { v: pad(h), l: labels?.h ?? 'h' });
  units.push(          { v: pad(m), l: labels?.m ?? 'm' });
  units.push(          { v: pad(s), l: labels?.s ?? 's' });

  return (
    <span className="inline-flex items-center gap-1 ml-3">
      {units.map(({ v, l }) => (
        <span key={l} className="inline-flex flex-col items-center justify-center px-1.5 py-0.5 rounded border border-current/35 bg-black/10 min-w-[1.75rem]">
          <span className="font-mono font-semibold text-xs tabular-nums leading-none">{v}</span>
          <span className="text-[9px] opacity-60 uppercase tracking-wide leading-none">{l}</span>
        </span>
      ))}
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

/* ─────────────────── Swap stack (text ↔ button vertical swap) ─────────────────── */
/**
 * Stacks textNode and buttonNode in the same grid cell, animating them
 * vertically so the text slides down and out, then the button slides
 * down into its place. Counter / promo code stay outside this stack.
 *
 * @param {{ textNode: ReactNode, buttonNode: ReactNode, seconds?: number }} props
 *   `seconds` is how long EACH side stays visible. Full cycle = 2 * seconds.
 */
export function SwapStack({ textNode, buttonNode, seconds = 4 }) {
  const cycle = Math.max(2, Math.min(60, Number(seconds) || 4) * 2);
  return (
    <span
      className="relative inline-grid items-center justify-items-center overflow-hidden align-middle"
      style={{ '--swap-dur': `${cycle}s`, minHeight: '2rem', lineHeight: 1.2 }}
    >
      <span
        className="animate-swap-text whitespace-nowrap inline-flex items-center"
        style={{ gridArea: '1 / 1' }}
      >
        {textNode}
      </span>
      <span
        className="animate-swap-button whitespace-nowrap inline-flex items-center"
        style={{ gridArea: '1 / 1' }}
      >
        {buttonNode}
      </span>
    </span>
  );
}

/* ─────────────────── Single announcement renderer ─────────────────── */
function AnnouncementContent({ a, dict }) {
  // For social type the platform buttons serve as the icon — suppress the generic icon
  const Icon = (a.icon_enabled && a.icon && a.type !== 'social') ? (ICONS[a.icon] ?? null) : null;

  const textNode = (
    <span style={{ fontSize: a.font_size ? `${a.font_size}px` : undefined }}>
      {a.text}
    </span>
  );

  // CTA isn't supported for marquee type (the message stream owns the bar).
  const safeCtaHref = a.type !== 'marquee' ? safeHref(a.cta_href) : null;
  const ctaNode = (a.type !== 'marquee' && a.cta_text) ? (
    safeCtaHref ? (
      <Link
        href={safeCtaHref}
        className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide bg-white text-black hover:bg-white/90 active:scale-95 transition-all shadow-sm"
      >
        {a.cta_text}
      </Link>
    ) : (
      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide bg-white text-black shadow-sm">
        {a.cta_text}
      </span>
    )
  ) : null;

  const swapMode = a.cta_display_mode === 'swap';
  const swapSeconds = Math.max(1, Math.min(30, Number(a.cta_swap_seconds) || 4));

  const inner = (
    <span className="inline-flex items-center gap-4 flex-wrap justify-center">
      {Icon && <Icon className="h-4 w-4 shrink-0" />}

      {swapMode && ctaNode ? (
        <SwapStack textNode={textNode} buttonNode={ctaNode} seconds={swapSeconds} />
      ) : (
        <>
          {textNode}
          {!swapMode && ctaNode && <span className="ms-1">{ctaNode}</span>}
        </>
      )}

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
          expiredLabel={dict?.expired ?? "Expired"}
        />
      )}

    </span>
  );

  return inner;
}

function SocialInfoPanel({ a }) {
  const phoneVal = a.social_whatsapp || a.social_facebook || a.social_instagram || a.social_tiktok || '';
  const showLogo = a.social_show_logo && a.social_logo_url;
  const showName = a.social_show_name && a.social_business_name;
  const showPhone = a.social_show_phone && phoneVal;
  if (!showLogo && !showName && !showPhone) return null;
  return (
    <span className="inline-flex items-center gap-2">
      {showLogo && (
        <img src={a.social_logo_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
      )}
      {(showName || showPhone) && (
        <span className="flex flex-col leading-tight">
          {showName && <span className="text-[11px] font-bold">{a.social_business_name}</span>}
          {showPhone && <span className="text-[10px] opacity-75">{phoneVal}</span>}
        </span>
      )}
    </span>
  );
}

function SocialButtons({ a }) {
  const platforms = Array.isArray(a.social_platforms) && a.social_platforms.length
    ? a.social_platforms
    : [
        a.social_whatsapp  && 'whatsapp',
        a.social_facebook  && 'facebook',
        a.social_instagram && 'instagram',
        a.social_tiktok    && 'tiktok',
      ].filter(Boolean);
  return (
    <>
      {platforms.map((pid) => {
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-colors"
            style={a.social_btn_color ? { backgroundColor: a.social_btn_color, color: '#fff' } : { backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            <Icon className="h-4 w-4" /> {link.label}
          </a>
        );
      })}
    </>
  );
}

/* ─────────────────── Marquee (scrolling banner) ─────────────────── */

/**
 * Renders one "copy" of all messages separated by `sep`.
 * Defined outside Marquee so React doesn't remount it on every render.
 */
function MarqueeCopy({ messages, icon: Icon, fontSize, sep }) {
  return (
    <>
      {messages.map((msg, i) => (
        <span key={i} className="inline-flex items-center shrink-0">
          {Icon && <Icon className="h-4 w-4 me-2" />}
          <span dir="auto" style={{ fontSize: fontSize ? `${fontSize}px` : undefined }}>{msg}</span>
          <span className="mx-4 opacity-60 select-none" aria-hidden="true">{sep}</span>
        </span>
      ))}
    </>
  );
}

/* ─── Individual mode: one message scrolls across and exits before the next ── */
function IndividualMarquee({ messages, speed, direction, pauseOnHover, Icon, fontSize }) {
  const containerRef = useRef(null);
  const probeRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const msg = messages[idx % messages.length];

  // Set CSS vars synchronously before paint so the animation reads correct values
  useLayoutEffect(() => {
    const container = containerRef.current;
    const probe = probeRef.current;
    if (!container || !probe) return;
    const vw = container.offsetWidth;
    const iw = probe.offsetWidth;
    if (!vw || !iw) return;
    // left: enter from right edge, exit past left edge
    // right: enter from left edge, exit past right edge
    const fromX = direction === 'right' ? -iw : vw;
    const toX   = direction === 'right' ? vw  : -iw;
    const dur   = Math.max(2, (vw + iw) / speed);
    container.style.setProperty('--msingle-from', `${fromX}px`);
    container.style.setProperty('--msingle-to',   `${toX}px`);
    container.style.setProperty('--msingle-dur',  `${dur}s`);
  }, [idx, speed, direction, msg]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden w-full relative min-h-[1.25rem]"
      dir="ltr"
      onMouseEnter={() => pauseOnHover && setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Invisible probe — measures the current message width before animation starts */}
      <span
        ref={probeRef}
        className="absolute top-0 left-0 invisible pointer-events-none inline-flex items-center whitespace-nowrap"
        aria-hidden="true"
      >
        {Icon && <Icon className="h-4 w-4 me-2" />}
        <span dir="auto" style={{ fontSize: fontSize ? `${fontSize}px` : undefined }}>{msg}</span>
      </span>

      {/* Animated element — key forces remount (animation restart) on each new message */}
      <span
        key={idx}
        className="absolute top-1/2 -translate-y-1/2 inline-flex items-center whitespace-nowrap animate-marquee-single"
        style={{ animationPlayState: paused ? 'paused' : 'running' }}
        onAnimationEnd={() => setIdx((i) => (i + 1) % Math.max(1, messages.length))}
      >
        {Icon && <Icon className="h-4 w-4 me-2" />}
        <span dir="auto" style={{ fontSize: fontSize ? `${fontSize}px` : undefined }}>{msg}</span>
      </span>
    </div>
  );
}

/* ─── Dispatcher: routes to group or individual mode ─────────────────────── */
export function MarqueePreview({ a }) {
  const messages = (Array.isArray(a.marquee_messages) && a.marquee_messages.length > 0)
    ? a.marquee_messages
    : (a.text ? [a.text] : []);
  const speed     = Math.max(10, Math.min(400, Number(a.marquee_speed) || 60));
  const direction = a.marquee_direction === 'right' ? 'right' : 'left';
  const pauseOnHover = a.marquee_pause_on_hover !== false;
  const sep       = (a.marquee_separator ?? '•') || '•';
  const Icon      = (a.icon_enabled && a.icon) ? (ICONS[a.icon] ?? null) : null;
  const scrollMode = a.marquee_scroll_mode === 'individual' ? 'individual' : 'together';

  if (messages.length === 0) return null;

  if (scrollMode === 'individual') {
    return (
      <IndividualMarquee
        messages={messages}
        speed={speed}
        direction={direction}
        pauseOnHover={pauseOnHover}
        Icon={Icon}
        fontSize={a.font_size}
      />
    );
  }

  // ── Group mode (all messages scroll together as one continuous band) ──────
  return <GroupMarquee messages={messages} speed={speed} direction={direction} pauseOnHover={pauseOnHover} sep={sep} Icon={Icon} fontSize={a.font_size} />;
}

function GroupMarquee({ messages, speed, direction, pauseOnHover, sep, Icon, fontSize }) {
  const containerRef = useRef(null);
  const probeRef = useRef(null);
  const [viewportW, setViewportW] = useState(0);
  const [duration, setDuration] = useState(20);

  useEffect(() => {
    const container = containerRef.current;
    const probe = probeRef.current;
    if (!container || !probe) return;

    const update = () => {
      const vw = container.offsetWidth;
      const cw = probe.offsetWidth;
      if (vw <= 0 || cw <= 0) return;
      setViewportW(vw);
      // One period = content travels (vw + cw) pixels: enter from right edge, exit past left edge
      setDuration(Math.max(4, (vw + cw) / speed));
    };

    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(container);
    ro?.observe(probe);
    return () => ro?.disconnect();
  }, [speed, messages.join('|'), sep]);

  if (messages.length === 0) return null;

  const copyProps = { messages, icon: Icon, fontSize, sep };

  /*
   * Track layout: [gap=vw] [copy1] [gap=vw] [copy2]
   * Total track width = 2*(vw + cw).
   *
   * Left animation (0 → -50%):
   *   - At t=0: gap1 fills viewport (blank). copy1 sits exactly at the right edge → enters immediately.
   *   - copy1 fully exits the left edge at the same moment copy2 enters the right edge. No overlap.
   *
   * Right animation (-50% → 0):
   *   - Symmetric: gap2 fills viewport at start. copy1 enters from the left edge.
   */
  const [paused, setPaused] = useState(false);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden w-full relative"
      dir="ltr"
      style={{ '--marquee-duration': `${duration}s` }}
      onMouseEnter={() => pauseOnHover && setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Invisible probe — measures the rendered width of one copy */}
      <div
        ref={probeRef}
        className="absolute top-0 left-0 invisible pointer-events-none inline-flex items-center"
        aria-hidden="true"
      >
        <MarqueeCopy {...copyProps} />
      </div>

      <div
        className={`inline-flex items-center w-max ${
          direction === 'right' ? 'animate-marquee-right' : 'animate-marquee-left'
        }`}
        style={{ animationPlayState: paused ? 'paused' : 'running' }}
      >
        {/* Leading gap — this is what fills the viewport at the start of each cycle */}
        <div style={{ width: viewportW, flexShrink: 0 }} aria-hidden="true" />
        {/* Copy 1 */}
        <span className="inline-flex items-center shrink-0">
          <MarqueeCopy {...copyProps} />
        </span>
        {/* Middle gap — separates copy1 from copy2 so they never overlap */}
        <div style={{ width: viewportW, flexShrink: 0 }} aria-hidden="true" />
        {/* Copy 2 — seamless clone */}
        <span className="inline-flex items-center shrink-0" aria-hidden="true">
          <MarqueeCopy {...copyProps} />
        </span>
      </div>
    </div>
  );
}

/* ─────────────────── Main component ─────────────────── */
export default function AnnouncementBar() {
  const pathname = usePathname();
  const dictionary = useDictionary();
  const { locale } = useLocale();
  const dict = dictionary?.admin?.settings?.announcements ?? {};
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
    const seq = ++_fetchSeq;
    fetch("/api/v1/announcements", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return;
        // Drop response if a newer fetch was started after us — prevents stale overwrite.
        if (seq !== _fetchSeq) return;
        const data = json?.success ? (json.data ?? []) : [];
        _cache = data;
        setItems(data);
        // Prune dismissed entries for items the server no longer returns.
        setDismissed((prev) => {
          if (!prev || prev.size === 0) return prev;
          const liveIds = new Set(data.map((d) => d.id));
          let changed = false;
          const next = new Map();
          for (const [id, ts] of prev) {
            if (liveIds.has(id)) next.set(id, ts);
            else changed = true;
          }
          if (!changed) return prev;
          writeDismissed(next);
          return next;
        });
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
      .filter((a) => !dismissed.has(a.id))
      .map((a) => resolveAnnouncementTranslation(a, locale));
    // tick included via ref; re-runs when schedule re-eval interval fires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, pathname, dismissed, tick, locale]);

  // Auto-rotate carousel — only when there are multiple visible items.
  // The legacy `carousel_enabled` flag is ignored: with multiple items we
  // rotate, with a single item we never do (avoids pointless re-renders).
  useEffect(() => {
    if (rotationRef.current) clearInterval(rotationRef.current);
    if (visible.length <= 1) return;
    const interval = (Number(visible[0]?.rotation_seconds) || 5) * 1000;
    rotationRef.current = setInterval(() => {
      setActiveIdx((i) => (i + 1) % visible.length);
    }, interval);
    return () => {
      if (rotationRef.current) clearInterval(rotationRef.current);
    };
  }, [visible]);

  // Clamp index when list shrinks
  useEffect(() => {
    if (activeIdx >= visible.length) setActiveIdx(0);
  }, [visible.length, activeIdx]);

  // Static bars slide out of view when user scrolls down (works for both top & bottom)
  const [scrollHidden, setScrollHidden] = useState(false);
  useEffect(() => {
    if (visible.length === 0) { setScrollHidden(false); return; }
    const cur = visible[activeIdx] ?? visible[0];
    const isStatic = cur?.behavior === 'static';
    if (!isStatic) { setScrollHidden(false); return; }
    const onScroll = () => setScrollHidden(window.scrollY > 5);
    onScroll(); // run immediately on mount / bar change
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); setScrollHidden(false); };
  }, [visible, activeIdx]);

  // Sync --bar-height CSS variable so the header knows how far to offset.
  // All bars are fixed at the top, so --bar-height always equals the bar's full height.
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

    if (!positionTop) {
      root.style.removeProperty('--bar-height');
      return;
    }

    const setOffset = (px) => root.style.setProperty('--bar-height', `${Math.max(0, px)}px`);

    const update = () => setOffset(scrollHidden ? 0 : el.offsetHeight);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); root.style.removeProperty('--bar-height'); };
  }, [visible, activeIdx, scrollHidden]);

  // Clear on unmount
  useEffect(() => {
    return () => document.documentElement.style.removeProperty('--bar-height');
  }, []);

  if (!items || visible.length === 0) return null;

  const current = visible[activeIdx] ?? visible[0];
  const positionTop = (current.position ?? "top") === "top";

  const handleDismiss = (id) => {
    const next = new Map(dismissed);
    next.set(id, Date.now());
    setDismissed(next);
    writeDismissed(next);
  };

  const goPrev = () =>
    setActiveIdx((i) => (i - 1 + visible.length) % visible.length);
  const goNext = () => setActiveIdx((i) => (i + 1) % visible.length);

  // Always fixed at top/bottom so the bar is never mixed into page content
  const positionClass = positionTop ? "top-0" : "bottom-0";
  const stickyClass = `fixed inset-x-0 ${positionClass} z-[51]`;

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
      className={`${stickyClass} ${borderClass} transition-transform duration-300 overflow-hidden`}
      style={{
        height: "2.5rem",
        transform: scrollHidden
          ? (positionTop ? 'translateY(-100%)' : 'translateY(100%)')
          : 'translateY(0)',
      }}
    >
      {/* Animated background layer — remounts on every index change */}
      <div
        key={activeIdx}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundColor: current.bg_color || '#111111',
        }}
      />

      {/* Content animates in on change */}
      <div
        key={`content-${activeIdx}`}
        className="relative flex flex-col justify-center"
        style={{ height: '100%', color: current.text_color || '#ffffff', animation: 'announce-bar-in 0.4s cubic-bezier(0.22,1,0.36,1) both' }}
      >
      {current.type === 'marquee' ? (
        <div className="relative flex items-center justify-center w-full py-1.5 text-sm">
          <div className="flex-1 min-w-0">
            <MarqueePreview a={current} />
          </div>
          {current.dismissible !== false && (
            <button
              type="button"
              onClick={() => handleDismiss(current.id)}
              aria-label="Dismiss"
              className="absolute end-2 sm:end-4 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : current.type === 'social' ? (
        /* Social bar owns the full row — always rendered LTR so info is
           physically left, text is centered, buttons+dismiss are on the right. */
        <div className="flex items-center gap-2 h-full px-3 sm:px-4 text-sm" dir="ltr">
          {/* Far left: logo + name/phone */}
          <div className="flex items-center gap-2 shrink-0">
            <SocialInfoPanel a={current} />
          </div>
          {/* Center: announcement text */}
          <div className="flex-1 text-center min-w-0" dir="auto">
            <span style={{ fontSize: current.font_size ? `${current.font_size}px` : undefined }}>
              {current.text}
            </span>
          </div>
          {/* Far right: social platform buttons + dismiss */}
          <div className="flex items-center gap-2 shrink-0">
            <SocialButtons a={current} />
            {visible.length > 1 && (
              <>
                <button type="button" onClick={goPrev} aria-label="Previous announcement"
                  className="hidden sm:inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={goNext} aria-label="Next announcement"
                  className="hidden sm:inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            {current.dismissible !== false && (
              <button type="button" onClick={() => handleDismiss(current.id)} aria-label="Dismiss"
                className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid items-center h-full px-2 sm:px-4 text-sm" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
          {/* Left: prev button (or spacer) */}
          <div className="flex items-center">
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
          </div>

          {/* Center: always truly centered */}
          <div
            className="flex items-center justify-center min-w-0"
            aria-live="polite"
            aria-atomic="true"
          >
            <AnnouncementContent a={current} dict={dict} />
          </div>

          {/* Right: next + dismiss */}
          <div className="flex items-center gap-1">
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
      )}
      </div>
    </div>
  );
}
