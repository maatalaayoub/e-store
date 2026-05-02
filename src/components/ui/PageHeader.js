"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { isRtlLocale } from "@/config/constants";

/**
 * Minimal fixed page header with a back button.
 * Hides on scroll-down, reveals on scroll-up.
 * Used on pages like My Orders and Favorites.
 */
export default function PageHeader({ title }) {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale ?? "en";
  const isRtl = isRtlLocale(locale);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 10) {
        setVisible(true);
      } else {
        setVisible(y < lastY.current);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100 transition-transform duration-300 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center h-9 w-9 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 transition-all"
          aria-label="Go back"
        >
          <BackIcon className="h-5 w-5" />
        </button>
        {title && (
          <span className="text-base font-semibold text-zinc-900">{title}</span>
        )}
      </div>
    </header>
  );
}
