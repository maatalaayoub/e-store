"use client";

import { Search, Filter, UserPlus, Users as UsersIcon, Mail } from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminCustomersSkeleton } from "@/components/skeletons";

export default function AdminCustomersPage() {
  const customers = [];
  const dict = useDictionary();
  const t = dict?.admin?.customers ?? {};
  const tStats = t.stats ?? {};
  const tH = t.headers ?? {};

  if (!dict?.admin?.customers) return <AdminCustomersSkeleton />;

  const stats = [
    { label: tStats.total, value: "0" },
    { label: tStats.new, value: "0" },
    { label: tStats.returning, value: "0" },
    { label: tStats.avg, value: "$0.00" },
  ];

  return (
    <>
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{t.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {t.subtitle}
          </p>
        </div>
        <button className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <UserPlus className="h-4 w-4" />
          {t.add}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-zinc-100 bg-white p-5"
          >
            <p className="text-sm font-medium text-zinc-500 mb-1">
              {stat.label}
            </p>
            <h3 className="text-xl font-bold text-zinc-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-100 bg-white">
        <div className="flex flex-col gap-4 border-b border-zinc-100 px-4 sm:px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-zinc-900">{t.all}</h2>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder={t.search}
                className="w-full sm:w-64 rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <button className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{dict?.common?.filter}</span>
            </button>
          </div>
        </div>

        {/* EMPTY STATE */}
        {customers.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-3">
              <UsersIcon className="h-6 w-6" />
            </div>
            <p className="font-medium text-zinc-900 mb-1">{t.empty_title}</p>
            <p className="text-sm text-zinc-500">{t.empty_desc}</p>
          </div>
        )}

        {/* MOBILE CARDS */}
        {customers.length > 0 && (
          <ul className="divide-y divide-zinc-200 sm:hidden">
            {customers.map((c) => (
              <li key={c.id} className="px-4 py-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      {c.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className="font-medium text-zinc-900 text-sm">{c.name}</span>
                  </div>
                  <button className="text-sm font-medium text-blue-600 hover:underline">{dict?.common?.view}</button>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  <Mail className="h-3.5 w-3.5 text-zinc-400" />{c.email}
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500">
                  <div><span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">{tH.orders}</span>{c.orders}</div>
                  <div><span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">{tH.spent}</span>{c.spent}</div>
                  <div><span className="block font-medium text-zinc-400 uppercase tracking-wide mb-0.5">{tH.joined}</span>{c.joined}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* DESKTOP TABLE */}
        {customers.length > 0 && (
          <div className="hidden sm:block">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-white text-xs uppercase text-zinc-400 border-b border-zinc-100">
                <tr>
                  <th className="px-6 py-3 font-medium">{tH.name}</th>
                  <th className="px-6 py-3 font-medium">{tH.email}</th>
                  <th className="px-6 py-3 font-medium">{tH.orders}</th>
                  <th className="px-6 py-3 font-medium">{tH.spent}</th>
                  <th className="px-6 py-3 font-medium">{tH.joined}</th>
                  <th className="px-6 py-3 font-medium text-right">{tH.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                          {c.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="font-medium text-zinc-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-zinc-400" />{c.email}</span>
                    </td>
                    <td className="px-6 py-4">{c.orders}</td>
                    <td className="px-6 py-4">{c.spent}</td>
                    <td className="px-6 py-4">{c.joined}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-sm font-medium text-blue-600 hover:underline">{dict?.common?.view}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
