/**
 * Dashboard Route Group Layout
 * Wraps all protected dashboard pages under /{locale}/(dashboard)/...
 * Slot for a future sidebar + top-bar shell.
 */

import DashboardLayout from '@/components/layouts/DashboardLayout';

export default function DashboardGroupLayout({ children }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
