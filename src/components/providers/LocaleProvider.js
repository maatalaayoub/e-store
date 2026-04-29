/**
 * LocaleProvider — Client Component
 *
 * - Sets the `lang` and `dir` attributes on <html> at runtime.
 * - Exposes the current locale, direction, and translation dictionary
 *   to descendant client components via React context.
 */

'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { localeMetadata } from '@/i18n/config';

const LocaleContext = createContext({ locale: 'en', dir: 'ltr', dictionary: {} });

/**
 * @param {{ locale: string, dictionary: Record<string, any>, children: React.ReactNode }} props
 */
export default function LocaleProvider({ locale, dictionary, children }) {
  const { dir } = localeMetadata[locale] ?? { dir: 'ltr' };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo(
    () => ({ locale, dir, dictionary: dictionary ?? {} }),
    [locale, dir, dictionary],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Returns the full translation dictionary for the active locale. */
export function useDictionary() {
  return useContext(LocaleContext).dictionary;
}

/** Returns `{ locale, dir, dictionary }` for the active locale. */
export function useLocale() {
  return useContext(LocaleContext);
}
