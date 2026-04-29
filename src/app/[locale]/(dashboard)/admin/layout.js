/**
 * Admin Section Layout
 * Wraps every /{locale}/admin/* page in the persistent AdminShell
 * (sidebar + top-bar) so sub-pages only render their content.
 */

import AdminShell from "@/components/layouts/AdminShell";

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
