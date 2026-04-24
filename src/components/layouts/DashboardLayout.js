/**
 * DashboardLayout
 *
 * Shell component for all protected dashboard pages (admin, analytics…).
 * Add a persistent <Sidebar> and top-bar here when ready.
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-full">
      {/* <Sidebar /> */}
      <div className="flex flex-1 flex-col">
        {/* <TopBar /> */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
