/**
 * i18n Configuration
 * Central source of truth for all locale-related settings.
 * Add new locales here to extend language support across the entire application.
 */

/** Ordered list of all supported locale identifiers. */
export const locales = ['en', 'ar', 'fr', 'dr'];

/** The locale used as the fallback when no match is detected. */
export const defaultLocale = 'en';

/**
 * Per-locale metadata.
 *
 * @property {string} nativeName - The language name written in that language.
 * @property {'ltr'|'rtl'} dir   - Text direction for HTML/CSS layout.
 */
export const localeMetadata = {
  en: { nativeName: 'English',    dir: 'ltr' },
  ar: { nativeName: 'العربية',    dir: 'rtl' },
  fr: { nativeName: 'Français',   dir: 'ltr' },
  dr: { nativeName: 'الدارجة',   dir: 'rtl' },
};
