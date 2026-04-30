"use client";

import { useState } from "react";
import {
  Store,
  CreditCard,
  Truck,
  Bell,
  Globe,
  Save,
} from "lucide-react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminSettingsSkeleton } from "@/components/skeletons";

const SECTION_DEFS = [
  { id: "general", icon: Store },
  { id: "payments", icon: CreditCard },
  { id: "shipping", icon: Truck },
  { id: "notifications", icon: Bell },
  { id: "localization", icon: Globe },
];

export default function AdminSettingsPage() {
  const [active, setActive] = useState("general");
  const dict = useDictionary();
  const t = dict?.admin?.settings ?? {};
  const tSec = t.sections ?? {};

  if (!dict?.admin?.settings) return <AdminSettingsSkeleton />;

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
          <Save className="h-4 w-4" />
          {t.save}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* SECTION NAV */}
        <aside className="rounded-xl border border-zinc-100 bg-white p-2 h-max">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {SECTION_DEFS.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tSec[s.id] ?? s.id}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* CONTENT */}
        <section className="rounded-xl border border-zinc-100 bg-white p-6">
          {active === "general" && <GeneralSection />}
          {active === "payments" && <PaymentsSection />}
          {active === "shipping" && <ShippingSection />}
          {active === "notifications" && <NotificationsSection />}
          {active === "localization" && <LocalizationSection />}
        </section>
      </div>
    </>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6 py-4 border-b border-zinc-100 last:border-0">
      <div>
        <label className="text-sm font-medium text-zinc-900">{label}</label>
        {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-600";

function SectionHeader({ title, description }) {
  return (
    <div className="pb-4 mb-2 border-b border-zinc-100">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="text-sm text-zinc-500 mt-1">{description}</p>
    </div>
  );
}

function GeneralSection() {
  const t = useDictionary()?.admin?.settings?.general ?? {};
  return (
    <>
      <SectionHeader
        title={t.title}
        description={t.desc}
      />
      <Field label={t.store_name} hint={t.store_name_hint}>
        <input className={inputClass} defaultValue="My Store" />
      </Field>
      <Field label={t.contact_email}>
        <input
          type="email"
          className={inputClass}
          placeholder="hello@mystore.com"
        />
      </Field>
      <Field label={t.description} hint={t.description_hint}>
        <textarea
          rows={3}
          className={inputClass}
          placeholder={t.description_placeholder}
        />
      </Field>
    </>
  );
}

function PaymentsSection() {
  const t = useDictionary()?.admin?.settings?.payments ?? {};
  return (
    <>
      <SectionHeader
        title={t.title}
        description={t.desc}
      />
      <Field label={t.currency}>
        <select className={inputClass}>
          <option>USD — US Dollar</option>
          <option>EUR — Euro</option>
          <option>MAD — Moroccan Dirham</option>
        </select>
      </Field>
      <Field label={t.stripe} hint={t.stripe_hint}>
        <input
          type="password"
          className={inputClass}
          placeholder="sk_live_..."
        />
      </Field>
      <Field label={t.cod}>
        <Toggle defaultChecked />
      </Field>
    </>
  );
}

function ShippingSection() {
  const t = useDictionary()?.admin?.settings?.shipping ?? {};
  return (
    <>
      <SectionHeader
        title={t.title}
        description={t.desc}
      />
      <Field label={t.origin}>
        <input className={inputClass} defaultValue="Morocco" />
      </Field>
      <Field label={t.flat} hint={t.flat_hint}>
        <input className={inputClass} defaultValue="5.00" />
      </Field>
      <Field label={t.free_threshold}>
        <input className={inputClass} placeholder="100.00" />
      </Field>
    </>
  );
}

function NotificationsSection() {
  const t = useDictionary()?.admin?.settings?.notifications ?? {};
  return (
    <>
      <SectionHeader
        title={t.title}
        description={t.desc}
      />
      <Field label={t.new_order}>
        <Toggle defaultChecked />
      </Field>
      <Field label={t.low_stock}>
        <Toggle defaultChecked />
      </Field>
      <Field label={t.weekly}>
        <Toggle />
      </Field>
    </>
  );
}

function LocalizationSection() {
  const t = useDictionary()?.admin?.settings?.localization ?? {};
  return (
    <>
      <SectionHeader
        title={t.title}
        description={t.desc}
      />
      <Field label={t.default_language}>
        <select className={inputClass}>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
          <option value="dr">Darija</option>
        </select>
      </Field>
      <Field label={t.timezone}>
        <select className={inputClass}>
          <option>UTC</option>
          <option>Africa/Casablanca</option>
          <option>Europe/Paris</option>
        </select>
      </Field>
    </>
  );
}

function Toggle({ defaultChecked = false }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        on ? "bg-blue-600" : "bg-zinc-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
