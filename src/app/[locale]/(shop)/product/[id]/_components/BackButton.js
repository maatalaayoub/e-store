"use client";

import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale || "en";

  const handleBack = () => {
    // In a freshly-opened tab (e.g. via target="_blank") there is no history
    // to go back to, so `router.back()` is a no-op. Detect that case and
    // navigate to the shop home instead so the button is always useful.
    if (typeof window === "undefined") {
      router.push(`/${locale}`);
      return;
    }
    const hasHistory = window.history.length > 1;
    const sameOriginReferrer =
      typeof document !== "undefined" &&
      document.referrer &&
      document.referrer.startsWith(window.location.origin);
    if (hasHistory && sameOriginReferrer) {
      router.back();
    } else {
      router.push(`/${locale}`);
    }
  };

  return (
    <button
      onClick={handleBack}
      aria-label="Go back"
      className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 transition-colors"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
