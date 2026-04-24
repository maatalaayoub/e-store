/**
 * Root Layout
 *
 * The single required Next.js root layout.  It intentionally contains no
 * locale-specific attributes — the LocaleProvider client component in
 * app/[locale]/layout.js sets `lang` and `dir` on <html> after hydration.
 *
 * `suppressHydrationWarning` on <html> and <body> silences the React
 * mismatch warning that would otherwise fire when LocaleProvider updates
 * those attributes on the client.
 */

import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata = {
  // Populated per-locale via generateMetadata in individual layouts / pages.
};

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning className={`${geist.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
