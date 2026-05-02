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

import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import AbortErrorSuppressor from "@/components/providers/AbortErrorSuppressor";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = {
  // Populated per-locale via generateMetadata in individual layouts / pages.
};

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning className={`${inter.variable} ${cairo.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <AbortErrorSuppressor />
        {children}
      </body>
    </html>
  );
}
