"use client";

import { Headset, RefreshCcw, Truck, Rocket } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";

export default function ShopPerks({ compact = false }) {
  const dict = useDictionary();
  const tPerks = dict?.perks ?? {};

  const perks = [
    { Icon: Headset, title: tPerks.support_title, desc: tPerks.support_desc },
    { Icon: RefreshCcw, title: tPerks.return_title, desc: tPerks.return_desc },
    { Icon: Truck, title: tPerks.free_shipping_title, desc: tPerks.free_shipping_desc },
    { Icon: Rocket, title: tPerks.express_title, desc: tPerks.express_desc },
  ];

  return (
    <section className={`bg-white ${compact ? "py-6" : "px-6 py-16"}`}>
      <div className={`mx-auto ${compact ? "" : "max-w-7xl rounded-xl border border-zinc-100 bg-white p-6 sm:p-8"}`}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
          {perks.map(({ Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-800">
                <Icon className="h-7 w-7" strokeWidth={1.25} />
              </div>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-900">
                {title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500 max-w-[160px]">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
