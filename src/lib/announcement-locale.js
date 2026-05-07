const FALLBACK_LOCALES = ['en', 'fr', 'ar', 'dr'];

/**
 * Resolves an announcement's translatable text fields (`text`, `cta_text`,
 * `marquee_messages`) from its `translations` JSONB column based on the given
 * locale. Falls back to the base column, then to the first locale that has
 * content, so an announcement is never silently empty just because a specific
 * locale hasn't been translated yet.
 *
 * @param {object} a       Raw announcement row.
 * @param {string} locale  e.g. "en" | "fr" | "ar" | "dr".
 * @returns {object} Announcement with localized fields applied.
 */
export function resolveAnnouncementTranslation(a, locale) {
  if (!a || !locale) return a;

  // Try the requested locale first, then fall back to other locales in order.
  const tryOrder = [locale, ...FALLBACK_LOCALES.filter((l) => l !== locale)];

  const next = { ...a };
  // For social type, an empty base text is intentional (buttons/info are the content).
  // Don't let per-locale translations silently restore the old text.
  const isSocialEmpty = a.type === 'social' && typeof a.text === 'string' && !a.text.trim();
  let textResolved = isSocialEmpty; // treat as already resolved → skip override
  let ctaResolved = false;
  let marqueeResolved = false;

  for (const loc of tryOrder) {
    const tr = a.translations?.[loc];
    if (!tr || typeof tr !== 'object') continue;

    if (!textResolved && typeof tr.text === 'string' && tr.text.trim()) {
      next.text = tr.text;
      textResolved = true;
    }
    if (!ctaResolved && typeof tr.cta_text === 'string' && tr.cta_text.trim()) {
      next.cta_text = tr.cta_text;
      ctaResolved = true;
    }
    if (!marqueeResolved && Array.isArray(tr.marquee_messages)) {
      const filtered = tr.marquee_messages
        .map((m) => (typeof m === 'string' ? m : ''))
        .filter((m) => m.trim().length > 0);
      if (filtered.length > 0) {
        next.marquee_messages = filtered;
        marqueeResolved = true;
      }
    }

    if (textResolved && ctaResolved && marqueeResolved) break;
  }

  return next;
}
