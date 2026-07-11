/**
 * Sanitize / normalize section descriptors before persisting.
 *
 * Defensive — tolerant of partial input from the admin UI but strictly
 * filters anything dangerous (script tags, javascript: hrefs, etc.).
 */

import sanitizeHtmlLib from 'sanitize-html';
import {
  SECTION_REGISTRY,
  generateSectionId,
  isValidType,
  getRegistryEntry,
} from './registry';

const SUPPORTED_LANGS = ['en', 'fr', 'ar', 'dr'];
const SAFE_HREF_RE = /^(?:https?:\/\/|\/[^/]|\/$|#|mailto:|tel:)/i;
const SAFE_HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const MAX_SECTIONS = 50;
const MAX_HTML_LEN = 20000;

function safeStr(v, max = 500) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function safeHref(v) {
  const s = safeStr(v, 500);
  if (!s) return null;
  return SAFE_HREF_RE.test(s) ? s : null;
}

function safeImageUrl(v) {
  const s = safeStr(v, 1000);
  if (!s) return null;
  if (SAFE_HTTP_URL_RE.test(s)) return s;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  return null;
}

function safeHex(v) {
  const s = safeStr(v, 12);
  if (!s) return null;
  return HEX_RE.test(s) ? s : null;
}

function safeBool(v, fallback = false) {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

function safeInt(v, { min, max, fallback = null } = {}) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  if (min != null && n < min) return min;
  if (max != null && n > max) return max;
  return n;
}

function pickEnum(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

const HTML_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u',
  'ul', 'ol', 'li', 'h2', 'h3', 'h4',
  'blockquote', 'a', 'code', 'pre', 'span',
];

/**
 * Sanitize HTML using a well-tested library.
 *
 * Whitelist: p, br, strong, em, b, i, u, ul, ol, li, h2, h3, h4, blockquote,
 *            a (href only, with rel + target hardened), code, pre, span.
 *
 * Output is safe to pass to dangerouslySetInnerHTML in the renderer.
 */
export function sanitizeHtml(input) {
  if (input == null) return null;
  let html = String(input);
  if (!html.trim()) return null;
  if (html.length > MAX_HTML_LEN) html = html.slice(0, MAX_HTML_LEN);

  const safe = sanitizeHtmlLib(html, {
    allowedTags: HTML_ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href'],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
    },
  });

  return safe.trim() ? safe : null;
}

function sanitizeTranslations(raw, fields) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const lang of SUPPORTED_LANGS) {
    const tr = raw[lang];
    if (!tr || typeof tr !== 'object') continue;
    const cleaned = {};
    for (const f of fields) {
      if (!(f in tr)) continue;
      const v = tr[f];
      if (Array.isArray(v)) {
        // Only sanitize string-list translations (e.g. simple FAQ items)
        const arr = v.map((x) => safeStr(x, 500)).filter(Boolean);
        if (arr.length > 0) cleaned[f] = arr;
      } else if (f === 'html') {
        const safe = sanitizeHtml(v);
        if (safe) cleaned[f] = safe;
      } else if (f === 'body') {
        const s = safeStr(v, 5000);
        if (s) cleaned[f] = s;
      } else {
        const s = safeStr(v, 500);
        if (s) cleaned[f] = s;
      }
    }
    if (Object.keys(cleaned).length > 0) out[lang] = cleaned;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sanitizeBaseConfig(raw, defaults) {
  const cfg = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    layout: pickEnum(cfg.layout, ['default', 'compact', 'wide', 'card'], defaults.layout ?? 'default'),
    width: pickEnum(cfg.width, ['container', 'wide', 'full'], defaults.width ?? 'container'),
    background: pickEnum(cfg.background, ['transparent', 'muted', 'accent', 'custom'], defaults.background ?? 'transparent'),
    background_color: safeHex(cfg.background_color),
    text_color: safeHex(cfg.text_color),
    padding: pickEnum(cfg.padding, ['none', 'sm', 'md', 'lg'], defaults.padding ?? 'md'),
    show_title: safeBool(cfg.show_title, defaults.show_title ?? true),
    title_color: safeHex(cfg.title_color ?? cfg.text_color), // backward-compat: accept old text_color too
    border_color: safeHex(cfg.border_color),
    border_width: safeInt(cfg.border_width, { min: 0, max: 20, fallback: 0 }),
  };
}

// ── per-type config + content sanitizers ─────────────────────────────────────

const TYPE_HANDLERS = {
  description: (raw, base) => ({
    config: { ...base.config, max_height: safeInt(raw.config?.max_height, { min: 100, max: 5000, fallback: null }) },
    content: { title: safeStr(raw.content?.title, 200) ?? base.content.title },
  }),

  gallery: (raw, base) => ({
    config: {
      ...base.config,
      columns: safeInt(raw.config?.columns, { min: 1, max: 6, fallback: 3 }),
      aspect: pickEnum(raw.config?.aspect, ['square', '4:3', '16:9', 'auto'], 'square'),
    },
    content: {
      title: safeStr(raw.content?.title, 200) ?? base.content.title,
      images: Array.isArray(raw.content?.images)
        ? raw.content.images
            .map((img) => ({
              url: safeImageUrl(img?.url),
              alt: safeStr(img?.alt, 200),
            }))
            .filter((img) => img.url)
            .slice(0, 30)
        : [],
    },
  }),

  shipping: (raw, base) => ({
    config: base.config,
    content: {
      title: safeStr(raw.content?.title, 200) ?? base.content.title,
      items: Array.isArray(raw.content?.items)
        ? raw.content.items
            .map((it) => ({
              icon: safeStr(it?.icon, 60) ?? null,
              title: safeStr(it?.title, 200),
              body: safeStr(it?.body, 1000),
            }))
            .filter((it) => it.title || it.body)
            .slice(0, 12)
        : [],
    },
  }),

  reviews: (raw, base) => ({
    config: { ...base.config, limit: safeInt(raw.config?.limit, { min: 1, max: 50, fallback: 5 }) },
    content: {
      title: safeStr(raw.content?.title, 200) ?? base.content.title,
      empty_text: safeStr(raw.content?.empty_text, 500) ?? base.content.empty_text,
    },
  }),

  ratings: (raw, base) => ({
    config: base.config,
    content: { title: safeStr(raw.content?.title, 200) ?? base.content.title },
  }),

  specifications: (raw, base) => ({
    config: base.config,
    content: {
      title: safeStr(raw.content?.title, 200) ?? base.content.title,
      items: Array.isArray(raw.content?.items)
        ? raw.content.items
            .map((it) => ({
              key: safeStr(it?.key, 200),
              value: safeStr(it?.value, 1000),
            }))
            .filter((it) => it.key)
            .slice(0, 50)
        : [],
    },
  }),

  faq: (raw, base) => ({
    config: base.config,
    content: {
      title: safeStr(raw.content?.title, 200) ?? base.content.title,
      items: Array.isArray(raw.content?.items)
        ? raw.content.items
            .map((it) => ({
              question: safeStr(it?.question, 500),
              answer: safeStr(it?.answer, 5000),
            }))
            .filter((it) => it.question && it.answer)
            .slice(0, 30)
        : [],
    },
  }),

  rich_text: (raw, base) => ({
    config: { ...base.config, align: pickEnum(raw.config?.align, ['start', 'center', 'end'], 'start') },
    content: {
      title: safeStr(raw.content?.title, 200) ?? '',
      body: safeStr(raw.content?.body, 5000) ?? '',
    },
  }),

  image_text: (raw, base) => ({
    config: { ...base.config, image_position: pickEnum(raw.config?.image_position, ['left', 'right'], 'left') },
    content: {
      title: safeStr(raw.content?.title, 200) ?? '',
      body: safeStr(raw.content?.body, 5000) ?? '',
      image_url: safeImageUrl(raw.content?.image_url) ?? '',
      cta_text: safeStr(raw.content?.cta_text, 80) ?? '',
      cta_href: safeHref(raw.content?.cta_href) ?? '',
    },
  }),

  video: (raw, base) => ({
    config: {
      ...base.config,
      aspect: pickEnum(raw.config?.aspect, ['16:9', '4:3', '1:1', '9:16'], '16:9'),
      autoplay: safeBool(raw.config?.autoplay, false),
    },
    content: {
      title: safeStr(raw.content?.title, 200) ?? '',
      video_url: safeImageUrl(raw.content?.video_url) ?? '',
    },
  }),

  banner: (raw, base) => ({
    config: base.config,
    content: {
      title: safeStr(raw.content?.title, 200) ?? '',
      subtitle: safeStr(raw.content?.subtitle, 300) ?? '',
      image_url: safeImageUrl(raw.content?.image_url) ?? '',
      cta_text: safeStr(raw.content?.cta_text, 80) ?? '',
      cta_href: safeHref(raw.content?.cta_href) ?? '',
    },
  }),

  related_products: (raw, base) => ({
    config: {
      ...base.config,
      columns: safeInt(raw.config?.columns, { min: 2, max: 6, fallback: 4 }),
      source: pickEnum(raw.config?.source, ['category', 'featured', 'latest'], 'category'),
      button_style: pickEnum(
        raw.config?.button_style,
        ['add_to_cart', 'shop_now', 'horizontal_style1', 'horizontal_style2', 'vertical'],
        'add_to_cart',
      ),
    },
    content: {
      title: safeStr(raw.content?.title, 200) ?? base.content.title,
      limit: safeInt(raw.content?.limit, { min: 2, max: 24, fallback: 8 }),
    },
  }),

  checkout: (raw, base) => {
    const ALLOWED_FIELDS = ['phone', 'fullName', 'country', 'city', 'state', 'zip', 'address'];
    const rawFields = Array.isArray(raw.config?.fields) ? raw.config.fields : base.config.fields;
    // Keep order from admin, drop unknowns and dedupe.
    const seen = new Set();
    const fields = [];
    for (const f of rawFields) {
      if (typeof f === 'string' && ALLOWED_FIELDS.includes(f) && !seen.has(f)) {
        seen.add(f);
        fields.push(f);
      }
    }
    let waCountries = raw.config?.whatsapp_countries;
    if (waCountries === null) {
      // null = always visible
    } else if (Array.isArray(waCountries)) {
      waCountries = waCountries.map((c) => safeStr(c, 80)).filter(Boolean).slice(0, 50);
    } else {
      waCountries = base.config.whatsapp_countries;
    }
    return {
      config: {
        ...base.config,
        fields,
        show_coupon: safeBool(raw.config?.show_coupon, base.config.show_coupon),
        show_place_order: safeBool(raw.config?.show_place_order, base.config.show_place_order),
        show_whatsapp: safeBool(raw.config?.show_whatsapp, base.config.show_whatsapp),
        show_summary: safeBool(raw.config?.show_summary, base.config.show_summary),
        whatsapp_countries: waCountries,
        label_color: safeHex(raw.config?.label_color),
        input_text_color: safeHex(raw.config?.input_text_color),
        placeholder_color: safeHex(raw.config?.placeholder_color),
        order_btn_bg: safeHex(raw.config?.order_btn_bg),
        order_btn_text_color: safeHex(raw.config?.order_btn_text_color),
        whatsapp_btn_bg: safeHex(raw.config?.whatsapp_btn_bg),
        whatsapp_btn_text_color: safeHex(raw.config?.whatsapp_btn_text_color),
      },
      content: {
        title: safeStr(raw.content?.title, 200) ?? base.content.title,
        subtitle: safeStr(raw.content?.subtitle, 300) ?? '',
      },
    };
  },

  custom: (raw, base) => ({
    config: { ...base.config, align: pickEnum(raw.config?.align, ['start', 'center', 'end'], 'start'), icon: safeStr(raw.config?.icon, 60) },
    content: {
      title: safeStr(raw.content?.title, 200) ?? '',
      subtitle: safeStr(raw.content?.subtitle, 300) ?? '',
      body: safeStr(raw.content?.body, 5000) ?? '',
      image_url: safeImageUrl(raw.content?.image_url) ?? '',
      cta_text: safeStr(raw.content?.cta_text, 80) ?? '',
      cta_href: safeHref(raw.content?.cta_href) ?? '',
      html: sanitizeHtml(raw.content?.html) ?? '',
    },
  }),
};

/**
 * Sanitize a single section descriptor. Returns null if the type is invalid.
 */
export function sanitizeSection(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidType(raw.type)) return null;

  const entry = getRegistryEntry(raw.type);
  const base = entry.defaults();
  base.config = sanitizeBaseConfig(raw.config, base.config);

  const handler = TYPE_HANDLERS[raw.type];
  const merged = handler
    ? handler({ config: raw.config, content: raw.content }, base)
    : { config: base.config, content: base.content };

  return {
    id: safeStr(raw.id, 80) ?? generateSectionId(),
    type: raw.type,
    enabled: safeBool(raw.enabled, true),
    order: safeInt(raw.order, { min: 0, max: 1000, fallback: idx }),
    config: merged.config,
    content: merged.content,
    translations: sanitizeTranslations(raw.translations, entry.translatableFields),
  };
}

/**
 * Sanitize a full sections array.
 *   • Drops invalid entries.
 *   • Re-numbers `order` starting at 0 (preserving submitted order).
 *   • Caps total length at MAX_SECTIONS.
 */
export function sanitizeSections(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s, i) => sanitizeSection(s, i))
    .filter(Boolean)
    .slice(0, MAX_SECTIONS)
    .map((s, i) => ({ ...s, order: i }));
}
