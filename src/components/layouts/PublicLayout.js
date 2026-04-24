/**
 * PublicLayout
 *
 * Shell component for all public-facing (storefront) pages.
 * Add a persistent <Header> and <Footer> here when ready.
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function PublicLayout({ children }) {
  return (
    <div className="flex min-h-full flex-col">
      {/* <Header /> */}
      <main className="flex-1">{children}</main>
      {/* <Footer /> */}
    </div>
  );
}
