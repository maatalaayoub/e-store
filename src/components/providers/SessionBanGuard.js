"use client";

/**
 * SessionBanGuard
 *
 * Mounted once at the storefront root. On every full-page navigation it
 * pings `/api/v1/users/track-device` — the endpoint that verifies the
 * *current* session against `users.is_banned` and `banned_devices`.
 *
 * If the account or device has been banned since the user signed in, we:
 *   1. sign the Supabase session out (so their cookie stops working), and
 *   2. redirect to /{locale}/login?banned=1 so the login page can display
 *      the "your account has been suspended" message.
 *
 * Admins are exempt server-side (the API returns 200 for them), so this
 * component is a no-op for admin sessions.
 *
 * The check runs once per mount and is silent on network failures — a
 * flaky network should never lock users out.
 */

import { useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const AUTH_PATH_PATTERN = /\/(login|signup|forgot-password|reset-password)(\/|$)/;

export default function SessionBanGuard() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  useEffect(() => {
    // Don't ping while the user is already on an auth page — otherwise we'd
    // sign them out mid-login attempt.
    if (AUTH_PATH_PATTERN.test(pathname ?? "")) return;

    let cancelled = false;
    const supabase = createClient();

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session) return; // guest — nothing to enforce here

        const res = await fetch("/api/v1/users/track-device", { method: "POST" });
        if (cancelled) return;
        if (res.status !== 403) return;

        const payload = await res.json().catch(() => ({}));
        if (!payload?.banned) return;

        await supabase.auth.signOut();
        const locale = params?.locale ?? "en";
        const q = new URLSearchParams({ banned: "1" });
        if (payload.reason) q.set("kind", String(payload.reason));
        if (payload.message) q.set("msg", String(payload.message).slice(0, 500));
        router.replace(`/${locale}/login?${q.toString()}`);
      } catch {
        // Never let this component break the page.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, params?.locale, router]);

  return null;
}
