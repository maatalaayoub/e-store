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
import { getDisplaySettings } from '@/lib/display-settings';
import LocaleProvider from '@/components/providers/LocaleProvider';
import CurrencyProvider from '@/components/providers/CurrencyProvider';
import CartAuthSync from '@/components/providers/CartAuthSync';
import DeviceIdInit from '@/components/providers/DeviceIdInit';
import SessionBanGuard from '@/components/providers/SessionBanGuard';
import DisplaySettingsProvider from '@/components/providers/DisplaySettingsProvider';
import AnnouncementBar from '@/components/shop/AnnouncementBar';
import MobileBottomNav from '@/components/shop/MobileBottomNav';
import { Toaster } from 'sonner';

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

  const [dictionary, displaySettings] = await Promise.all([
    getDictionary(locale),
    getDisplaySettings(),
  ]);

  return (
    <LocaleProvider locale={locale} dictionary={dictionary}>
      <DisplaySettingsProvider initial={displaySettings}>
        <CurrencyProvider>
          <DeviceIdInit />
          <SessionBanGuard />
          <CartAuthSync />
          <AnnouncementBar />
          <div style={{ paddingTop: 'var(--bar-height, 0px)' }}>
            {children}
          </div>
          <MobileBottomNav />
          <Toaster position="bottom-center" richColors />
        </CurrencyProvider>
      </DisplaySettingsProvider>
    </LocaleProvider>
  );
}
