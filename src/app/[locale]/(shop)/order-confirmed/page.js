"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Phone, Package, Truck } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { isRtlLocale } from "@/config/constants";

export default function OrderConfirmedPage() {
  const { locale } = useParams();
  const dict = useDictionary();
  const t = dict?.order_confirmed ?? {};
  const isRtl = isRtlLocale(locale);

  const steps = [
    { Icon: Package, text: t.step1 ?? "Our team will review your order." },
    { Icon: Phone,   text: t.step2 ?? "We will call you to confirm availability and delivery." },
    { Icon: Truck,   text: t.step3 ?? "Your order will be prepared and shipped." },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-20" dir={isRtl ? "rtl" : "ltr"}>
      {/* Success icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 mb-6">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 text-center">
        {t.title ?? "Order Received!"}
      </h1>
      <p className="mt-3 text-sm sm:text-base text-zinc-500 text-center max-w-sm leading-relaxed">
        {t.subtitle ?? "Thank you for your order. We will call you shortly to confirm the details."}
      </p>

      {/* Steps */}
      <div className="mt-10 w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4 text-center">
          {t.what_next ?? "What happens next?"}
        </p>
        <ol className="flex flex-col gap-3">
          {steps.map(({ Icon, text }, i) => (
            <li key={i} className="flex items-start gap-4 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700">
                {i + 1}
              </span>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Icon className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.5} />
                <span className="text-sm text-zinc-700">{text}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Actions */}
      <div className="mt-10 flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Link
          href={`/${locale}/orders`}
          className="flex-1 inline-flex items-center justify-center rounded-lg border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          {t.orders ?? "My Orders"}
        </Link>
        <Link
          href={`/${locale}`}
          className="flex-1 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
        >
          {t.continue ?? "Continue Shopping"}
        </Link>
      </div>
    </div>
  );
}
