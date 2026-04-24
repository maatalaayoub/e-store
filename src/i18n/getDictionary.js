/**
 * Dictionary Loader — Server-only
 *
 * NOTE: Install the `server-only` package (`npm i server-only`) and
 * uncomment the line below to prevent this module from being accidentally
 * imported in Client Components.
 *
 * import 'server-only';
 *
 * Dictionaries are lazy-loaded at request time so only the active locale's
 * JSON is included in the server response.
 */

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((m) => m.default),
  ar: () => import('./dictionaries/ar.json').then((m) => m.default),
  fr: () => import('./dictionaries/fr.json').then((m) => m.default),
  dr: () => import('./dictionaries/dr.json').then((m) => m.default),
};

/**
 * Returns true when the provided string is a recognised locale.
 * Use this to narrow the type before calling getDictionary.
 *
 * @param {string} locale
 * @returns {boolean}
 */
export const hasLocale = (locale) => locale in dictionaries;

/**
 * Asynchronously loads the translation dictionary for the given locale.
 * Must only be called from Server Components or Route Handlers.
 *
 * @param {string} locale - A validated locale key (en | ar | fr | dr).
 * @returns {Promise<Record<string, unknown>>}
 */
export const getDictionary = async (locale) => dictionaries[locale]();
