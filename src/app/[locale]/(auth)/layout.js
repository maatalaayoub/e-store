/**
 * Auth Route Group Layout
 * Wraps all authentication pages under /{locale}/(auth)/...
 * Slot for a future centered auth shell (logo + card container).
 */

import AuthLayout from '@/components/layouts/AuthLayout';

export default function AuthGroupLayout({ children }) {
  return <AuthLayout>{children}</AuthLayout>;
}
