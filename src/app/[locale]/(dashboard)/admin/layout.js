/**
 * Admin Section Layout
 * Wraps every /{locale}/admin/* page in the persistent AdminShell
 * (sidebar + top-bar) so sub-pages only render their content.
 * Redirects non-admin users to the home page.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/middlewares/authGuard';
import AdminShell from "@/components/layouts/AdminShell";

export default async function AdminLayout({ children, params }) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user.id))) {
    redirect(`/${locale}`);
  }

  return <AdminShell>{children}</AdminShell>;
}
