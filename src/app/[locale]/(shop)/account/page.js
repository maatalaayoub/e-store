"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Pencil,
  User,
  MapPin,
  Package,
  Heart,
  Mail,
  Shield,
  LogOut,
  Check,
  X,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";
import { isRtlLocale } from "@/config/constants";
import SearchableCombobox from "@/components/ui/SearchableCombobox";
import { COUNTRIES, findCountry, detectCountryFromIp } from "@/data/countries";

function useStoreLogo() {
  const [logo, setLogo] = useState({ url: null, size: "160", height: "40" });
  useEffect(() => {
    fetch("/api/v1/display-settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setLogo({
            url: json.data.store_logo ?? null,
            size: json.data.store_logo_size ?? "160",
            height: json.data.store_logo_height ?? "40",
          });
        }
      })
      .catch(() => {});
  }, []);
  return logo;
}

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
  const [createdAt, setCreatedAt] = useState(() => _accountCache?.createdAt ?? "");
  const [form, setForm] = useState(() => _accountCache?.form ?? {
    full_name: "",
    phone_number: "",
    address: "",
    city: "",
    country: "",
  });

  const logo = useStoreLogo();

  /* ── Cities powered by country-state-city (free, offline). The library
     is ~200 KB sync, so we lazy-import it once the user picks a country. ── */
  const selectedIso = useMemo(
    () => findCountry(form.country)?.isoCode ?? null,
    [form.country]
  );

  const [cities, setCities] = useState([]);
  useEffect(() => {
    if (!selectedIso) return;
    let cancelled = false;
    import("country-state-city").then(({ City }) => {
      if (cancelled) return;
      const names = (City.getCitiesOfCountry(selectedIso) ?? []).map((c) => c.name);
      setCities(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
    }).catch(() => { if (!cancelled) setCities([]); });
    return () => { cancelled = true; };
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
        if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);

        const d = json.data ?? {};
        const emailVal = d.email ?? "";
        const createdAtVal = d.created_at ?? "";
        const formVal = {
          full_name:    d.full_name    ?? "",
          phone_number: d.phone_number ?? "",
          address:      d.address      ?? "",
          city:         d.city         ?? "",
          country:      d.country      ?? "",
        };
        setEmail(emailVal);
        setCreatedAt(createdAtVal);
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
        _accountCache = { email: emailVal, createdAt: createdAtVal, form: formVal };
      } catch (err) {
        if (err?.name !== "AbortError") {
          setError(err?.message || (tAccount.load_error ?? "Failed to load profile."));
        }
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
      _accountCache = { email, createdAt, form: { ...form } };
      setEditing(false);
    } catch (err) {
      setError(err.message || (tAccount.save_error ?? "Failed to save changes."));
    } finally {
      setSaving(false);
    }
  };

  const avatarInitial = useMemo(() => {
    const name = form.full_name?.trim() || email?.trim() || "?";
    return name.charAt(0).toUpperCase();
  }, [form.full_name, email]);

  const displayName = form.full_name?.trim() || tAccount.no_name || "Account";

  const logoMaxHeight = useMemo(() => {
    const h = parseInt(logo.height || "40", 10) || 40;
    return Math.min(Math.max(h, 20), 120);
  }, [logo.height]);

  const navItems = [
    { href: `/${locale}/account`, label: tAccount.title ?? "Account Settings", icon: User, active: true },
    { href: `/${locale}/orders`, label: dict?.account?.orders ?? "My Orders", icon: Package, active: false },
    { href: `/${locale}/favorites`, label: dict?.account?.favorites ?? "Favorites", icon: Heart, active: false },
  ];

  const inputCls = editing
    ? "w-full rounded-[5px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
    : "w-full rounded-[5px] border border-transparent bg-zinc-100/60 px-4 py-3 text-sm text-zinc-700 outline-none cursor-default select-none";

  const labelCls = "block text-sm font-medium text-zinc-700 mb-2";

  return (
    <div className="min-h-screen bg-white" dir={dir}>
      {/* ── Top bar — full width, no max-w ── */}
      <header
        style={{ top: 'var(--bar-height, 0px)' }}
        className="sticky z-10 border-b border-zinc-100 bg-white/80 backdrop-blur-md"
      >
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] text-zinc-500 transition-colors hover:bg-zinc-100"
          >
            <BackIcon className="h-5 w-5" />
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold uppercase tracking-wide text-zinc-900">
              {tAccount.title ?? "Account Settings"}
            </span>
            <span className="hidden text-xs text-zinc-500 sm:block">
              {tAccount.page_title ?? "Personal & Shipping Information"}
            </span>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* ── Sidebar ── */}
            <aside className="lg:col-span-4 xl:col-span-3">
              <div className="sticky top-[calc(var(--bar-height,0px)+5.5rem)] space-y-4">
                {/* Profile card */}
                <div className="overflow-hidden rounded-[5px] border border-zinc-100 bg-white">
                  <div className="flex items-center justify-between px-5 py-5">
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900">{displayName}</h2>
                      {createdAt && (
                        <p className="mt-1 text-xs text-zinc-400">
                          {dict?.account?.member_since ?? "Member since"}{" "}
                          {new Date(createdAt).toLocaleDateString(locale, { year: "numeric", month: "long" })}
                        </p>
                      )}
                    </div>
                    {!editing && (
                      <button
                        type="button"
                        onClick={() => { setEditing(true); setSaved(false); }}
                        className="flex items-center gap-1.5 rounded-[5px] border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                      >
                        <Pencil className="h-3 w-3" />
                        {tAccount.edit ?? "Edit"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Navigation */}
                <nav className="rounded-[5px] border border-zinc-100 bg-white p-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-[5px] px-3 py-2.5 text-sm font-medium transition-colors ${
                          item.active
                            ? "bg-blue-50 text-blue-700"
                            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                      </Link>
                    );
                  })}
                  <div className="my-1.5 h-px bg-zinc-100" />
                  <button
                    type="button"
                    onClick={async () => {
                      const { createClient } = await import("@/lib/supabase/client");
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      router.push(`/${locale}/login`);
                    }}
                    className="flex w-full items-center gap-3 rounded-[5px] px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-start">{dict?.account?.logout ?? "Sign out"}</span>
                  </button>
                </nav>
              </div>
            </aside>

            {/* ── Main content ── */}
            <div className="lg:col-span-8 xl:col-span-9">
              <form onSubmit={handleSave} className="space-y-6">
                {/* Personal info card */}
                <section className="rounded-[5px] border border-zinc-100 bg-white p-5 sm:p-6">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-blue-50 text-blue-600">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-zinc-900">
                        {tAccount.personal_info ?? "Personal Information"}
                      </h2>
                      <p className="text-xs text-zinc-500">
                        {dict?.account?.personal_hint ?? "How we can reach you"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelCls}>{tAccount.full_name ?? "Full Name"}</label>
                      <input
                        type="text"
                        value={form.full_name}
                        onChange={setField("full_name")}
                        readOnly={!editing}
                        placeholder={editing ? (tAccount.full_name_placeholder ?? "Your full name") : "—"}
                        className={inputCls}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelCls}>{tAccount.phone ?? "Phone Number"}</label>
                      <input
                        type="tel"
                        value={form.phone_number}
                        onChange={setField("phone_number")}
                        readOnly={!editing}
                        placeholder={editing ? (hint(form.country, "phone") || "+1 555 000 0000") : "—"}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </section>

                {/* Address card */}
                <section className="rounded-[5px] border border-zinc-100 bg-white p-5 sm:p-6">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-emerald-50 text-emerald-600">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-zinc-900">
                        {tAccount.address_info ?? "Shipping Address"}
                      </h2>
                      <p className="text-xs text-zinc-500">
                        {dict?.account?.address_hint ?? "Used for checkout and deliveries"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>{tAccount.country ?? "Country"}</label>
                      {editing ? (
                        <SearchableCombobox
                          items={COUNTRIES}
                          value={form.country}
                          onChange={(val) => {
                            setForm((f) => ({ ...f, country: val, city: "" }));
                            if (!val) setCities([]);
                            setSaved(false);
                            setError(null);
                          }}
                          placeholder={tAccount.country_placeholder ?? "Select your country"}
                          disabledMsg="No countries available"
                          searchPlaceholder="Search country..."
                          isRtl={isRtl}
                        />
                      ) : (
                        <div className={inputCls}>
                          {COUNTRIES.find((c) => c.value === form.country)?.label || <span className="text-zinc-400">—</span>}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className={labelCls}>{tAccount.city ?? "City"}</label>
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
                        <div className={inputCls}>
                          {form.city || <span className="text-zinc-400">—</span>}
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelCls}>{tAccount.address ?? "Street Address"}</label>
                      <input
                        type="text"
                        value={form.address}
                        onChange={setField("address")}
                        readOnly={!editing}
                        placeholder={editing ? (hint(form.country, "address") || (tAccount.address_placeholder ?? "123 Main St")) : "—"}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </section>

                {/* Security note */}
                {!editing && (
                  <section className="flex items-start gap-3 rounded-[5px] border border-zinc-100 bg-white p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-zinc-100 text-zinc-600">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-zinc-900">{dict?.account?.security_title ?? "Account Security"}</h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {dict?.account?.security_text ?? "Your information is stored securely and never shared with third parties."}
                      </p>
                    </div>
                  </section>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 rounded-[5px] bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    <X className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Save / Cancel */}
                {editing && (
                  <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-6">
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setError(null); setSaved(false); }}
                      className="rounded-[5px] border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      {tAccount.cancel ?? "Cancel"}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-[5px] bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
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
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
