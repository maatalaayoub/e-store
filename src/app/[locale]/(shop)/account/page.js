"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Pencil } from "lucide-react";
import { City } from "country-state-city";
import { toast } from "sonner";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";
import { isRtlLocale } from "@/config/constants";
import SearchableCombobox from "@/components/ui/SearchableCombobox";
import { COUNTRIES, findCountry, detectCountryFromIp } from "@/data/countries";

// Module-level cache: persists across client-side navigations, cleared on hard refresh
let _accountCache = null;

/* ─── Per-country placeholder hints ─────────────────────────── */
const COUNTRY_HINTS = {
  "Morocco":        { phone: "+212 6 00 00 00 00", address: "25 Rue Mohammed V" },
  "Algeria":        { phone: "+213 5 00 00 00 00", address: "12 Rue Didouche Mourad" },
  "Tunisia":        { phone: "+216 20 000 000",    address: "15 Avenue Habib Bourguiba" },
  "Libya":          { phone: "+218 91 000 0000",   address: "Shara Ben Ashour" },
  "Egypt":          { phone: "+20 10 0000 0000",   address: "15 Talaat Harb St" },
  "France":         { phone: "+33 1 00 00 00 00",  address: "12 Rue de Rivoli, Appt 3" },
  "Germany":        { phone: "+49 30 000 0000",    address: "Unter den Linden 10, EG" },
  "United Kingdom": { phone: "+44 20 7946 0000",   address: "12 Baker Street, Flat 2" },
  "Italy":          { phone: "+39 02 0000 0000",   address: "Via del Corso 10, Int. 3" },
  "Spain":          { phone: "+34 91 000 0000",    address: "Calle Gran Via 28, Piso 2" },
  "Netherlands":    { phone: "+31 20 000 0000",    address: "Keizersgracht 100" },
  "Belgium":        { phone: "+32 2 000 0000",     address: "Rue de la Loi 15" },
  "Sweden":         { phone: "+46 8 000 0000",     address: "Kungsgatan 12, 2 tr" },
  "Norway":         { phone: "+47 21 00 00 00",    address: "Karl Johans gate 1" },
  "Denmark":        { phone: "+45 32 00 00 00",    address: "Stroget 15, 2. sal" },
  "Finland":        { phone: "+358 9 000 0000",    address: "Mannerheimintie 10" },
  "Switzerland":    { phone: "+41 44 000 00 00",   address: "Bahnhofstrasse 12" },
  "Austria":        { phone: "+43 1 000 0000",     address: "Karntner Strasse 10" },
  "Portugal":       { phone: "+351 21 000 0000",   address: "Rua Augusta 10, 2Dt" },
  "Poland":         { phone: "+48 22 000 0000",    address: "ul. Marszalkowska 10" },
  "Czech Republic": { phone: "+420 2 0000 0000",   address: "Vaclavske namesti 1" },
  "Romania":        { phone: "+40 21 000 0000",    address: "Calea Victoriei 12" },
  "Hungary":        { phone: "+36 1 000 0000",     address: "Vaci utca 10" },
  "Greece":         { phone: "+30 21 0000 0000",   address: "Ermou 10" },
  "Ireland":        { phone: "+353 1 000 0000",    address: "O'Connell Street 10" },
  "Croatia":        { phone: "+385 1 000 0000",    address: "Ilica 10" },
  "Slovakia":       { phone: "+421 2 0000 0000",   address: "Obchodna 10" },
  "Bulgaria":       { phone: "+359 2 000 0000",    address: "Vitosha Blvd 10" },
  "Serbia":         { phone: "+381 11 000 0000",   address: "Knez Mihailova 10" },
  "Ukraine":        { phone: "+380 44 000 0000",   address: "Khreshchatyk St 10" },
  "United States":  { phone: "+1 555 000 0000",    address: "123 Main St, Apt 4B" },
  "Canada":         { phone: "+1 416 000 0000",    address: "250 King St W, Suite 100" },
  "Mexico":         { phone: "+52 55 0000 0000",   address: "Paseo de la Reforma 100" },
};
const hint = (country, field) => COUNTRY_HINTS[country]?.[field] ?? "";

/* ─────────────────────────────────────────────────────────────
   Account Settings Page
───────────────────────────────────────────────────────────── */
export default function AccountSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale || "en";
  const { dir } = useLocale();
  const dict = useDictionary();
  const tAccount = dict?.account ?? {};
  const isRtl = isRtlLocale(locale);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const [loading, setLoading] = useState(() => _accountCache === null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState(() => _accountCache?.email ?? "");
  const [form, setForm] = useState(() => _accountCache?.form ?? {
    full_name: "",
    phone_number: "",
    address: "",
    city: "",
    country: "",
  });

  /* ── Cities powered by country-state-city (free, offline) ── */
  const selectedIso = useMemo(
    () => findCountry(form.country)?.isoCode ?? null,
    [form.country]
  );

  const cities = useMemo(() => {
    if (!selectedIso) return [];
    const names = (City.getCitiesOfCountry(selectedIso) ?? []).map((c) => c.name);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [selectedIso]);

  /* ── Load profile + auto-detect country from IP via ISO country_code ── */
  useEffect(() => {
    if (_accountCache !== null) return; // already cached, skip fetch
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch("/api/v1/users/me", { signal: controller.signal });
        if (res.status === 401) { router.push(`/${locale}/login`); return; }
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        const d = json.data;
        const emailVal = d.email ?? "";
        const formVal = {
          full_name:    d.full_name    ?? "",
          phone_number: d.phone_number ?? "",
          address:      d.address      ?? "",
          city:         d.city         ?? "",
          country:      d.country      ?? "",
        };
        setEmail(emailVal);
        setForm(formVal);

        /* Auto-detect from IP only when no country is saved.
           Uses ISO country_code matching (see detectCountryFromIp). */
        if (!d.country) {
          const detected = await detectCountryFromIp(controller.signal);
          if (detected) {
            formVal.country = detected;
            setForm((f) => ({ ...f, country: detected }));
          }
        }
        _accountCache = { email: emailVal, form: formVal };
      } catch (err) {
        if (err?.name !== "AbortError")
          setError(tAccount.load_error ?? "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    load().catch(() => {});
    return () => controller.abort();
  }, [locale, router, tAccount.load_error]);

  /* ── Form handlers ── */
  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setSaved(false);
    setError(null);
  };

  const handleCityChange = (cityName) => {
    setForm((f) => ({ ...f, city: cityName }));
    setSaved(false);
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(tAccount.saved ?? "Changes saved!");
      _accountCache = { email, form: { ...form } };
      setEditing(false);
    } catch (err) {
      setError(err.message || (tAccount.save_error ?? "Failed to save changes."));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = editing
    ? "w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white transition-colors"
    : "w-full rounded-lg border border-transparent bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700 outline-none cursor-default select-none";

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top bar ── */}
      <header style={{ top: 'var(--bar-height, 0px)' }} className="bg-white border-b border-zinc-100 sticky z-10">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 transition-colors"
          >
            <BackIcon className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold tracking-wide uppercase text-zinc-800">
            {tAccount.title ?? "Account Settings"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-8" dir={dir}>

            {/* Page title + Edit button */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-lg font-bold text-zinc-900">
                {tAccount.page_title ?? "Personal & Shipping Information"}
              </h1>
              {!editing && (
                <button
                  type="button"
                  onClick={() => { setEditing(true); setSaved(false); }}
                  className="self-start flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {tAccount.edit ?? "Edit"}
                </button>
              )}
            </div>

            <div className="border-t border-zinc-100" />

            {/* Personal info */}
            <section className="space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-900">
                {tAccount.personal_info ?? "Personal Information"}
              </h2>

              <div>
                <label className="block text-sm text-zinc-700 mb-1.5">
                  {tAccount.full_name ?? "Full Name"}
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={setField("full_name")}
                  readOnly={!editing}
                  placeholder={editing ? (tAccount.full_name_placeholder ?? "Your full name") : "—"}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-700 mb-1.5">
                  {tAccount.phone ?? "Phone Number"}
                </label>
                <input
                  type="tel"
                  value={form.phone_number}
                  onChange={setField("phone_number")}
                  readOnly={!editing}
                  placeholder={editing ? (hint(form.country, "phone") || "+1 555 000 0000") : "—"}
                  className={inputCls}
                />
              </div>
            </section>

            <div className="border-t border-zinc-100" />

            {/* Address info */}
            <section className="space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-900">
                {tAccount.address_info ?? "Address"}
              </h2>

              {/* Country — searchable combobox */}
              <div>
                <label className="block text-sm text-zinc-700 mb-1.5">
                  {tAccount.country ?? "Country"}
                </label>
                {editing ? (
                  <SearchableCombobox
                    items={COUNTRIES}
                    value={form.country}
                    onChange={(val) => {
                      setForm((f) => ({ ...f, country: val, city: "" }));
                      setSaved(false);
                      setError(null);
                    }}
                    placeholder={tAccount.country_placeholder ?? "Select your country"}
                    disabledMsg="No countries available"
                    searchPlaceholder="Search country..."
                    isRtl={isRtl}
                  />
                ) : (
                  <div className="rounded-lg bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
                    {COUNTRIES.find((c) => c.value === form.country)?.label || <span className="text-zinc-400">—</span>}
                  </div>
                )}
              </div>

              {/* City — searchable combobox powered by country-state-city */}
              <div>
                <label className="block text-sm text-zinc-700 mb-1.5">
                  {tAccount.city ?? "City"}
                </label>
                {editing ? (
                  <SearchableCombobox
                    items={cities}
                    value={form.city}
                    onChange={handleCityChange}
                    placeholder={tAccount.city_placeholder ?? "Select your city"}
                    disabledMsg="Select a country first"
                    searchPlaceholder="Search city..."
                    isRtl={isRtl}
                  />
                ) : (
                  <div className="rounded-lg bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
                    {form.city || <span className="text-zinc-400">—</span>}
                  </div>
                )}
              </div>

              {/* Street address */}
              <div>
                <label className="block text-sm text-zinc-700 mb-1.5">
                  {tAccount.address ?? "Street Address"}
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={setField("address")}
                  readOnly={!editing}
                  placeholder={editing ? (hint(form.country, "address") || (tAccount.address_placeholder ?? "123 Main St")) : "—"}
                  className={inputCls}
                />
              </div>
            </section>

            {/* Error */}
            {error && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            {/* Save / Cancel — only shown when editing */}
            {editing && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setError(null); setSaved(false); }}
                  className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all"
                >
                  {tAccount.cancel ?? "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-700 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    tAccount.save ?? "Save Changes"
                  )}
                </button>
              </div>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
