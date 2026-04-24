/**
 * Public Route Group Layout
 * Wraps all public-facing (storefront) pages under /{locale}/(public)/...
 * Slot for a future Header + Footer shell.
 */

import PublicLayout from '@/components/layouts/PublicLayout';

export default function PublicGroupLayout({ children }) {
  return <PublicLayout>{children}</PublicLayout>;
}
