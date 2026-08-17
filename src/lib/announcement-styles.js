/**
 * Pre-built announcement style presets.
 *
 * Each type (promotion, shipping, limited, social, notification, marquee)
 * exposes 6 presets. A preset is a gradient of 2-4 colors + an SVG pattern
 * overlay + a coordinated text color. Presets are stored on an announcement
 * as `bg_style` (a preset id) and, optionally, `bg_style_colors` (a caller-
 * supplied color override so admins can retune a preset's palette). When
 * `bg_style` is null the storefront falls back to the plain `bg_color`.
 */

const OVERLAY_LIGHT = 'rgba(255,255,255,0.14)';
const OVERLAY_DARK = 'rgba(0,0,0,0.08)';

const encSvg = (svg) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const PATTERNS = {
  dots: (c) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='2' cy='2' r='1.5' fill='${c}'/></svg>`,
  diag: (c) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><path d='M0 20 L20 0 M-5 5 L5 -5 M15 25 L25 15' stroke='${c}' stroke-width='1'/></svg>`,
  grid: (c) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><path d='M28 0H0V28' fill='none' stroke='${c}' stroke-width='1'/></svg>`,
  wave: (c) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20'><path d='M0 10 Q10 0 20 10 T40 10' fill='none' stroke='${c}' stroke-width='1.5'/></svg>`,
  stars: (c) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><path d='M20 5 L23 15 L33 15 L25 21 L28 31 L20 25 L12 31 L15 21 L7 15 L17 15 Z' fill='${c}'/></svg>`,
  bubbles: (c) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='10' cy='10' r='4' fill='${c}'/><circle cx='30' cy='30' r='3' fill='${c}'/><circle cx='34' cy='8' r='2' fill='${c}'/></svg>`,
};

/**
 * Raw preset definitions — only data. Derived fields (`bg`, `css`, `solid`)
 * are computed by `buildStyle` so a caller can override the color stops.
 */
const RAW_PRESETS = {
  promotion: [
    { id: 'promo-sunset',   label: 'Sunset Blaze',  colors: ['#ff6b6b','#feca57'], direction: '135deg', text: '#ffffff', pattern: 'wave',    overlay: OVERLAY_LIGHT },
    { id: 'promo-midnight', label: 'Midnight Gold', colors: ['#0f172a','#312e81'], direction: '135deg', text: '#fde68a', pattern: 'stars',   overlay: 'rgba(253,230,138,0.16)' },
    { id: 'promo-cherry',   label: 'Cherry Pop',    colors: ['#e11d48','#f43f5e'], direction: '135deg', text: '#ffffff', pattern: 'bubbles', overlay: OVERLAY_LIGHT },
    { id: 'promo-purple',   label: 'Purple Glow',   colors: ['#6d28d9','#c026d3'], direction: '135deg', text: '#ffffff', pattern: 'dots',    overlay: OVERLAY_LIGHT },
    { id: 'promo-ocean',    label: 'Ocean Deal',    colors: ['#0891b2','#06b6d4'], direction: '135deg', text: '#ffffff', pattern: 'wave',    overlay: OVERLAY_LIGHT },
    { id: 'promo-neon',     label: 'Neon Grid',     colors: ['#020617','#1e293b'], direction: '135deg', text: '#22d3ee', pattern: 'grid',    overlay: 'rgba(34,211,238,0.18)' },
  ],
  shipping: [
    { id: 'ship-forest', label: 'Forest Route',  colors: ['#064e3b','#065f46'], direction: '135deg', text: '#ffffff', pattern: 'dots',    overlay: OVERLAY_LIGHT },
    { id: 'ship-cool',   label: 'Cool Delivery', colors: ['#0e7490','#0891b2'], direction: '135deg', text: '#ffffff', pattern: 'diag',    overlay: OVERLAY_LIGHT },
    { id: 'ship-fresh',  label: 'Fresh Green',   colors: ['#059669','#84cc16'], direction: '135deg', text: '#ffffff', pattern: 'bubbles', overlay: OVERLAY_LIGHT },
    { id: 'ship-sky',    label: 'Sky Express',   colors: ['#0ea5e9','#3b82f6'], direction: '135deg', text: '#ffffff', pattern: 'wave',    overlay: OVERLAY_LIGHT },
    { id: 'ship-kraft',  label: 'Package Kraft', colors: ['#78350f','#92400e'], direction: '135deg', text: '#fef3c7', pattern: 'grid',    overlay: 'rgba(254,243,199,0.14)' },
    { id: 'ship-steel',  label: 'Cargo Steel',   colors: ['#334155','#0f172a'], direction: '135deg', text: '#f1f5f9', pattern: 'diag',    overlay: OVERLAY_LIGHT },
  ],
  limited: [
    { id: 'limit-fire',      label: 'Fire Red',       colors: ['#7f1d1d','#dc2626'], direction: '135deg', text: '#ffffff', pattern: 'wave', overlay: OVERLAY_LIGHT },
    { id: 'limit-amber',     label: 'Amber Alert',    colors: ['#f59e0b','#dc2626'], direction: '135deg', text: '#ffffff', pattern: 'diag', overlay: OVERLAY_LIGHT },
    { id: 'limit-blackout',  label: 'Blackout Sale',  colors: ['#000000','#3f0f0f'], direction: '135deg', text: '#f87171', pattern: 'diag', overlay: 'rgba(248,113,113,0.18)' },
    { id: 'limit-countdown', label: 'Countdown Grid', colors: ['#1e293b','#0f172a'], direction: '135deg', text: '#fbbf24', pattern: 'grid', overlay: 'rgba(251,191,36,0.14)' },
    { id: 'limit-neon',      label: 'Neon Warning',   colors: ['#831843','#e11d48'], direction: '135deg', text: '#fce7f3', pattern: 'diag', overlay: OVERLAY_LIGHT },
    { id: 'limit-lava',      label: 'Lava Flow',      colors: ['#ea580c','#b91c1c'], direction: '135deg', text: '#ffffff', pattern: 'wave', overlay: OVERLAY_LIGHT },
  ],
  social: [
    { id: 'soc-ig',      label: 'Instagram Sunset', colors: ['#833ab4','#fd1d1d','#fcb045'],                    direction: '135deg', text: '#ffffff', pattern: 'dots',    overlay: OVERLAY_LIGHT },
    { id: 'soc-wa',      label: 'WhatsApp Green',   colors: ['#128c7e','#25d366'],                              direction: '135deg', text: '#ffffff', pattern: 'bubbles', overlay: OVERLAY_LIGHT },
    { id: 'soc-fb',      label: 'Facebook Blue',    colors: ['#0866ff','#1e40af'],                              direction: '135deg', text: '#ffffff', pattern: 'grid',    overlay: OVERLAY_LIGHT },
    { id: 'soc-tt',      label: 'TikTok Neon',      colors: ['#010101','#25f4ee','#010101','#fe2c55'],          direction: '135deg', text: '#ffffff', pattern: 'stars',   overlay: OVERLAY_LIGHT },
    { id: 'soc-rainbow', label: 'All Rainbow',      colors: ['#ef4444','#f59e0b','#84cc16','#06b6d4','#8b5cf6'], direction: '90deg',  text: '#ffffff', pattern: 'dots',    overlay: OVERLAY_LIGHT },
    { id: 'soc-dark',    label: 'Follow Us Dark',   colors: ['#0f0f10','#27272a'],                              direction: '135deg', text: '#e4e4e7', pattern: 'stars',   overlay: 'rgba(228,228,231,0.14)' },
  ],
  notification: [
    { id: 'notif-charcoal', label: 'Charcoal Wave', colors: ['#27272a','#3f3f46'], direction: '135deg', text: '#ffffff', pattern: 'wave',    overlay: OVERLAY_LIGHT },
    { id: 'notif-soft',     label: 'Soft Gray',     colors: ['#f4f4f5','#e4e4e7'], direction: '135deg', text: '#18181b', pattern: 'dots',    overlay: OVERLAY_DARK },
    { id: 'notif-blue',     label: 'Info Blue',     colors: ['#1e3a8a','#2563eb'], direction: '135deg', text: '#ffffff', pattern: 'grid',    overlay: OVERLAY_LIGHT },
    { id: 'notif-slate',    label: 'Slate Ripple',  colors: ['#475569','#334155'], direction: '135deg', text: '#ffffff', pattern: 'bubbles', overlay: OVERLAY_LIGHT },
    { id: 'notif-paper',    label: 'Paper',         colors: ['#fafaf9','#e7e5e4'], direction: '135deg', text: '#292524', pattern: 'diag',    overlay: OVERLAY_DARK },
    { id: 'notif-muted',    label: 'Muted Green',   colors: ['#365314','#4d7c0f'], direction: '135deg', text: '#f7fee7', pattern: 'dots',    overlay: OVERLAY_LIGHT },
  ],
  marquee: [
    { id: 'mrq-neon',    label: 'Neon Loop',      colors: ['#000000','#111827'], direction: '135deg', text: '#22d3ee', pattern: 'grid',  overlay: 'rgba(34,211,238,0.18)' },
    { id: 'mrq-stripes', label: 'Racing Stripes', colors: ['#dc2626','#000000'], direction: '135deg', text: '#ffffff', pattern: 'diag',  overlay: OVERLAY_LIGHT },
    { id: 'mrq-zebra',   label: 'Zebra',          colors: ['#18181b','#3f3f46'], direction: '135deg', text: '#ffffff', pattern: 'diag',  overlay: OVERLAY_LIGHT },
    { id: 'mrq-retro',   label: 'Retro Wave',     colors: ['#831843','#7c3aed'], direction: '135deg', text: '#fce7f3', pattern: 'grid',  overlay: 'rgba(252,231,243,0.16)' },
    { id: 'mrq-gold',    label: 'Gold Marquee',   colors: ['#a16207','#eab308'], direction: '135deg', text: '#1f2937', pattern: 'stars', overlay: OVERLAY_DARK },
    { id: 'mrq-dots',    label: 'Marching Dots',  colors: ['#065f46','#059669'], direction: '135deg', text: '#ffffff', pattern: 'dots',  overlay: OVERLAY_LIGHT },
  ],
};

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function sanitizeColorsInPlace(colors, fallback) {
  const cleaned = colors
    .map((c) => (typeof c === 'string' ? c.trim() : ''))
    .filter((c) => HEX_RE.test(c));
  if (cleaned.length < 2) return fallback;
  return cleaned;
}

/**
 * Build the derived render fields (`bg`, `css`, `solid`) from a raw preset,
 * optionally with a caller-supplied color override array.
 */
function buildStyle(preset, colorsOverride) {
  const colors = Array.isArray(colorsOverride) && colorsOverride.length >= 2
    ? sanitizeColorsInPlace(colorsOverride, preset.colors)
    : preset.colors;
  const direction = preset.direction || '135deg';
  const bg = `linear-gradient(${direction},${colors.join(',')})`;
  const solid = colors[0];
  const patternSvg = PATTERNS[preset.pattern](preset.overlay);
  const css = `url("${encSvg(patternSvg)}") repeat, ${bg}, ${solid}`;
  return { ...preset, colors, bg, solid, css };
}

export const ANNOUNCEMENT_STYLE_PRESETS = Object.fromEntries(
  Object.entries(RAW_PRESETS).map(([type, arr]) => [type, arr.map((p) => buildStyle(p))]),
);

const ALL_STYLE_IDS = new Set(
  Object.values(RAW_PRESETS).flatMap((arr) => arr.map((p) => p.id)),
);

export function isKnownAnnouncementStyleId(id) {
  return typeof id === 'string' && ALL_STYLE_IDS.has(id);
}

/**
 * Parse a stored color-override value (accepts a comma-separated string or
 * an array). Returns a validated array of hex strings, or `null` when the
 * input is unusable.
 */
export function parseAnnouncementStyleColors(input) {
  if (!input) return null;
  const arr = Array.isArray(input) ? input : String(input).split(',');
  const cleaned = arr
    .map((c) => String(c ?? '').trim())
    .filter((c) => HEX_RE.test(c));
  return cleaned.length >= 2 ? cleaned : null;
}

export function resolveAnnouncementStyle(type, id, colorsOverride) {
  if (!id) return null;
  let raw = RAW_PRESETS[type]?.find((p) => p.id === id) ?? null;
  if (!raw) {
    for (const arr of Object.values(RAW_PRESETS)) {
      const hit = arr.find((p) => p.id === id);
      if (hit) { raw = hit; break; }
    }
  }
  if (!raw) return null;
  return buildStyle(raw, parseAnnouncementStyleColors(colorsOverride));
}

/** Convenience: get the default color stops for a preset (used to seed edits). */
export function getPresetDefaultColors(id) {
  for (const arr of Object.values(RAW_PRESETS)) {
    const hit = arr.find((p) => p.id === id);
    if (hit) return [...hit.colors];
  }
  return null;
}
