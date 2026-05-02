/**
 * Locale Root Layout
 *
 * Wraps every route under /{locale}/*.
 * Responsibilities:
 *   - Validates the locale parameter and returns 404 for unsupported values.
 *   - Provides the LocaleProvider so all child components can read locale/dir.
 *   - Declares generateStaticParams so Next.js pre-renders all 4 locale trees.
 */

import { notFound } from 'next/navigation';
import { locales } from '@/i18n/config';
import { getDictionary } from '@/i18n/getDictionary';
import LocaleProvider from '@/components/providers/LocaleProvider';
import CurrencyProvider from '@/components/providers/CurrencyProvider';

/**
 * Pre-render one static param set per supported locale.
 * Remove this export if you prefer fully dynamic (SSR-only) locale routes.
 */
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;

  if (!locales.includes(locale)) notFound();

  const dictionary = await getDictionary(locale);

  return (
    <LocaleProvider locale={locale} dictionary={dictionary}>
      <CurrencyProvider>
        {children}
      </CurrencyProvider>
    </LocaleProvider>
  );
}
