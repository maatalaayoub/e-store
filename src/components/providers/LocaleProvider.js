/**
 * LocaleProvider — Client Component
 *
 * Sets the `lang` and `dir` attributes on the root <html> element at
 * runtime, keeping server-rendered HTML and hydrated output in sync.
 *
 * Using `suppressHydrationWarning` on <html> in the root layout allows
 * React to update these attributes without a hydration mismatch warning.
 */

'use client';

import { useEffect } from 'react';
import { localeMetadata } from '@/i18n/config';

/**
 * @param {{ locale: string, children: React.ReactNode }} props
 */
export default function LocaleProvider({ locale, children }) {
  const { dir } = localeMetadata[locale] ?? { dir: 'ltr' };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  return children;
}
