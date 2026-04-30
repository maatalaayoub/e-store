"use client";

import { Headset, RefreshCcw, Truck, Rocket } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";

export default function ShopPerks() {
  const dict = useDictionary();
  const tPerks = dict?.perks ?? {};

  const perks = [
    { Icon: Headset, title: tPerks.support_title, desc: tPerks.support_desc },
    { Icon: RefreshCcw, title: tPerks.return_title, desc: tPerks.return_desc },
    { Icon: Truck, title: tPerks.free_shipping_title, desc: tPerks.free_shipping_desc },
    { Icon: Rocket, title: tPerks.express_title, desc: tPerks.express_desc },
  ];

  return (
    <section className="px-6 py-16 bg-white">
      <div className="mx-auto max-w-7xl rounded-xl border border-zinc-100 bg-white p-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-4">
              <Icon className="w-8 h-8 text-blue-600 shrink-0" strokeWidth={1} />
              <div>
                <h3 className="text-base font-medium text-zinc-900">{title}</h3>
                <p className="text-sm text-zinc-500 mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
