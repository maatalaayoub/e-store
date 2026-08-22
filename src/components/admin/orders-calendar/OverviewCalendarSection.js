"use client";

/**
 * OverviewCalendarSection (Phase 5, revenue variant)
 *
 * High-level revenue calendar for the Admin Overview. Shows summary revenue
 * (today / this week / this month) plus the reusable calendar in "revenue"
 * mode, where each day collapses into its total revenue. Read-only.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { CircleDollarSign, TrendingUp, Wallet } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useAdminOrderView } from "@/components/providers/AdminOrderViewContext";
import OrdersCalendarContainer from "./OrdersCalendarContainer";
import { formatMadShort } from "./order-events";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
// Monday as the first day of the week.
function startOfWeek(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function startOfMonth(d) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export default function OverviewCalendarSection() {
  const dict = useDictionary();
  const t = dict?.admin?.orders?.calendar ?? {};
  const title = t.revenue ?? "Revenue";
  const viewAll = dict?.common?.view_all ?? "View all";
  const router = useRouter();
  const { locale } = useParams();
  const { openOrder } = useAdminOrderView();

  const [revenue, setRevenue] = useState({ today: 0, week: 0, month: 0 });

  // Clicking an order routes to the Orders page and opens its drawer there.
  const handleOrderClick = useCallback(
    (id) => {
      openOrder(id);
      router.push(`/${locale}/admin/orders`);
    },
    [openOrder, router, locale],
  );

  useEffect(() => {
    const controller = new AbortController();
    const now = new Date();
    const from = new Date(Math.min(startOfMonth(now).getTime(), startOfWeek(now).getTime()));
    const params = new URLSearchParams({ from: from.toISOString(), to: now.toISOString() });
    fetch(`/api/v1/orders?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.success) return;
        const sod = startOfDay(now).getTime();
        const sow = startOfWeek(now).getTime();
        const som = startOfMonth(now).getTime();
        let today = 0;
        let week = 0;
        let month = 0;
        for (const o of json.data ?? []) {
          const c = new Date(o.created_at).getTime();
          const amount = Number(o.total_amount ?? 0);
          if (c >= som) month += amount;
          if (c >= sow) week += amount;
          if (c >= sod) today += amount;
        }
        setRevenue({ today, week, month });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const cards = [
    { key: "today", label: t.revenue_today ?? "Revenue today", value: revenue.today, icon: CircleDollarSign },
    { key: "week", label: t.revenue_week ?? "Revenue this week", value: revenue.week, icon: TrendingUp },
    { key: "month", label: t.revenue_month ?? "Revenue this month", value: revenue.month, icon: Wallet },
  ];

  return (
    <section className="mt-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/orders`)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {viewAll}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ key, label, value, icon: Icon }) => (
          <div key={key} className="flex items-center gap-4 rounded-[3px] border border-zinc-100 bg-white p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-emerald-50 text-emerald-600">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">{label}</p>
              <h3 className="text-2xl font-bold text-zinc-900 whitespace-nowrap">{formatMadShort(value)}</h3>
            </div>
          </div>
        ))}
      </div>

      <OrdersCalendarContainer mode="revenue" onOrderClick={handleOrderClick} />
    </section>
  );
}
