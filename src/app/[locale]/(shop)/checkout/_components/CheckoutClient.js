"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Trash2, Minus, Plus } from "lucide-react";
import { City } from "country-state-city";
import { useCartStore } from "@/store/useCartStore";
import { WHATSAPP_NUMBER } from "@/config/constants";
import { isRtlLocale } from "@/config/constants";
import SearchableCombobox from "@/components/ui/SearchableCombobox";
import { COUNTRIES, findCountry, detectCountryFromIp } from "@/data/countries";
import { resolveProductTranslation } from "@/lib/product-locale";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { parsePrice } from "@/lib/price";

/* ── Per-country placeholder text ── */
const COUNTRY_HINTS = {
  "United States":  { phone: "+1 555 000 0000", city: "New York",       address: "123 Main St, Apt 4B",          zip: "10001",  state: "NY" },
  "United Kingdom": { phone: "+44 20 7946 0000", city: "London",       address: "12 Baker Street, Flat 2",      zip: "SW1A 1AA", state: "England" },
  "Canada":         { phone: "+1 416 000 0000", city: "Toronto",        address: "250 King St W, Suite 100",     zip: "M5V 1J2", state: "Ontario" },
  "Australia":      { phone: "+61 2 0000 0000", city: "Sydney",         address: "1 George St, Unit 5",          zip: "2000",   state: "NSW" },
  "Morocco":        { phone: "+212 6 00 00 00 00", city: "Casablanca",  address: "25 Rue Mohammed V",            zip: "",        state: "" },
  "France":         { phone: "+33 1 00 00 00 00", city: "Paris",        address: "12 Rue de Rivoli, Appt 3",    zip: "75001",  state: "Île-de-France" },
  "Germany":        { phone: "+49 30 000 0000", city: "Berlin",         address: "Unter den Linden 10, EG",     zip: "10117",  state: "Berlin" },
  "Italy":          { phone: "+39 02 0000 0000", city: "Rome",          address: "Via del Corso 10, Int. 3",    zip: "00186",  state: "Lazio" },
  "Spain":          { phone: "+34 91 000 0000", city: "Madrid",         address: "Calle Gran Vía 28, Piso 2",   zip: "28013",  state: "Community of Madrid" },
  "Netherlands":    { phone: "+31 20 000 0000", city: "Amsterdam",      address: "Keizersgracht 100, 1 hoog",   zip: "1015 CL", state: "North Holland" },
  "Belgium":        { phone: "+32 2 000 0000", city: "Brussels",        address: "Rue de la Loi 15, Boîte 3",  zip: "1000",   state: "Brussels" },
  "Sweden":         { phone: "+46 8 000 0000", city: "Stockholm",       address: "Kungsgatan 12, 2 tr",         zip: "111 43", state: "Stockholm" },
};
const hint = (country, field) => COUNTRY_HINTS[country]?.[field] ?? "";

export default function CheckoutClient({ locale, dict }) {
  const router = useRouter();
  const { items, clearCart, removeItem, updateQuantity } = useCartStore();
  const tCheckout = dict?.checkout ?? {};
  const tCart = dict?.cart ?? {};
  const isRtl = isRtlLocale(locale);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  /* ── Hydration & IP Country guard ── */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const fetchCountry = async () => {
      try {
        const detected = await detectCountryFromIp(controller.signal);
        if (mounted && detected) setForm((f) => ({ ...f, country: detected }));
      } catch (err) {
        if (err?.name !== "AbortError") { /* ignore */ }
      }
    };

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/v1/users/me", { signal: controller.signal });
        if (res.ok) {
          const json = await res.json();
          if (mounted && json.success) {
            const d = json.data;
            setForm((f) => ({
              ...f,
              fullName: d.full_name || f.fullName,
              phone: d.phone_number || f.phone,
              address: d.address || f.address,
              city: d.city || f.city,
              country: d.country || f.country,
            }));
          }
        }
      } catch (err) {
        if (err?.name !== "AbortError") { /* ignore — guest checkout still works */ }
      }
    };

    if (mounted) setHydrated(true);
    fetchCountry();
    fetchProfile();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  /* ── Form state ── */
  const [form, setForm] = useState({
    phone: "",
    fullName: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "Morocco",
  });
  const [discount, setDiscount] = useState("");
  const [placing, setPlacing] = useState(false);
  const [errors, setErrors] = useState({});

  const { formatPrice, currency, rate } = useCurrency();

  /** Base subtotal always stays in MAD (stored in DB as MAD) */
  const subtotal = items.reduce(
    (acc, item) => acc + parsePrice(item.effective_price ?? item.price) * item.quantity,
    0
  );

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((err) => ({ ...err, [field]: undefined }));
  };

  /* ── Cities powered by country-state-city (offline) ── */
  const selectedIso = useMemo(
    () => findCountry(form.country)?.isoCode ?? null,
    [form.country]
  );
  const cities = useMemo(() => {
    if (!selectedIso) return [];
    const names = (City.getCitiesOfCountry(selectedIso) ?? []).map((c) => c.name);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [selectedIso]);

  const validate = () => {
    const e = {};
    if (!form.phone.trim()) e.phone = "Required";
    if (!form.fullName.trim()) e.fullName = "Required";
    if (!form.address.trim()) e.address = "Required";
    if (!form.city.trim()) e.city = "Required";
    if (form.country !== "Morocco" && !form.zip.trim()) e.zip = "Required";
    if (!form.country.trim()) e.country = "Required";
    return e;
  };

  const handleOrderWhatsApp = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const lines = [
      `*New Order*`,
      ``,
      `*Customer:* ${form.fullName}`,
      `*Phone:* ${form.phone}`,
      `*City:* ${form.city}`,
      `*Address:* ${form.address}`,
      ``,
      `*Items:*`,
      ...items.map((item) => {
        const resolved = resolveProductTranslation(item, locale);
        const price = parsePrice(item.effective_price ?? item.price);
        return `- ${resolved.name} x${item.quantity} = ${formatPrice(price * item.quantity)}`;
      }),
      ``,
      `*Total: ${formatPrice(subtotal)}*`,
    ];
    const msg = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  const handlePlaceOrder = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setPlacing(true);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping: {
            full_name: form.fullName,
            phone: form.phone,
            address: form.address,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country,
          },
          items: items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            unit_price_mad: parsePrice(item.effective_price ?? item.price),
          })),
          total_mad: subtotal,
          currency_code: currency.code,
          exchange_rate: rate,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        console.error('[Order failed]', json);
        throw new Error(json.details || json.error || 'Order failed');
      }
      clearCart();
      router.push(`/${locale}/order-confirmed?id=${json.data.id}`);
    } catch (err) {
      console.error(err);
      setErrors((prev) => ({ ...prev, submit: tCheckout.failed ?? "Failed to place order. Please try again." }));
      setPlacing(false);
    }
  };

  /* ── Input style helper ── */
  const inputCls = (field) =>
    `w-full rounded border px-3 py-2 text-sm outline-none transition-colors placeholder:text-zinc-400 ${
      errors[field]
        ? "border-red-400 focus:border-red-500"
        : "border-zinc-200 bg-zinc-50/50 focus:border-zinc-400 focus:bg-white"
    }`;

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top bar ── */}
      <header className="bg-white border-b border-zinc-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 transition-colors"
          >
            <BackIcon className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold tracking-widest uppercase text-zinc-800">
            {tCheckout.title ?? "Checkout"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_420px] xl:grid-cols-[auto_480px] gap-12 lg:gap-24">

          {/* ════ LEFT COLUMN ════ */}
          <div className="space-y-8 max-w-2xl w-full">

            {/* Contact information */}
            <section>
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-900">
                  {tCheckout.contact_info ?? "Contact Information"}
                </h2>
                <span className="text-xs text-zinc-500">{tCheckout.required_marker ?? "* Required"}</span>
              </div>

              <div>
                <label className="block text-sm text-zinc-700 mb-1.5">
                  {tCheckout.phone_label ?? "Email or Phone Number"} <span className="text-zinc-900">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder={hint(form.country, "phone") || "+1 555 000 0000"}
                  className={inputCls("phone")}
                />
                {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
              </div>
            </section>

            <div className="border-t border-transparent" />

            {/* Shipping address */}
            <section>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-900 mb-6">
                {tCheckout.shipping_address ?? "Shipping Address"}
              </h2>

              <div className="space-y-5">
                {/* 1 — Full Name */}
                <div>
                  <label className="block text-sm text-zinc-700 mb-1.5">
                    {tCheckout.full_name ?? "Full Name"} <span className="text-zinc-900">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={set("fullName")}
                    placeholder="Enter your full name"
                    className={inputCls("fullName")}
                  />
                  {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
                </div>

                {/* 2 — Country */}
                <div>
                  <label className="block text-sm text-zinc-700 mb-1.5">
                    {tCheckout.country ?? "Country"} <span className="text-zinc-900">*</span>
                  </label>
                  <SearchableCombobox
                    items={COUNTRIES}
                    value={form.country}
                    onChange={(val) => {
                      setForm((f) => ({ ...f, country: val, city: "", state: "", zip: "" }));
                      setErrors((err) => ({ ...err, country: undefined, city: undefined, zip: undefined }));
                    }}
                    placeholder={tCheckout.country_placeholder ?? "Select your country"}
                    disabledMsg="No countries available"
                    searchPlaceholder="Search country..."
                    isRtl={isRtl}
                  />
                  {errors.country && <p className="mt-1 text-xs text-red-500">{errors.country}</p>}
                </div>

                {/* 3 — City (+ optional State / Zip side-by-side) */}
                <div className={`grid grid-cols-1 gap-4 ${form.country !== "Morocco" ? "sm:grid-cols-3" : ""}`}>
                  <div>
                    <label className="block text-sm text-zinc-700 mb-1.5">
                      {tCheckout.city ?? "City"} <span className="text-zinc-900">*</span>
                    </label>
                    <SearchableCombobox
                      items={cities}
                      value={form.city}
                      onChange={(val) => {
                        setForm((f) => ({ ...f, city: val }));
                        setErrors((err) => ({ ...err, city: undefined }));
                      }}
                      placeholder={tCheckout.city_placeholder ?? "Select your city"}
                      disabledMsg="Select a country first"
                      searchPlaceholder="Search city..."
                      isRtl={isRtl}
                    />
                    {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
                  </div>
                  {form.country !== "Morocco" && (
                    <>
                      <div>
                        <label className="block text-sm text-zinc-700 mb-1.5">{tCheckout.state ?? "State/Province"}</label>
                        <input
                          type="text"
                          value={form.state}
                          onChange={set("state")}
                          placeholder={hint(form.country, "state")}
                          className={inputCls("state")}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-700 mb-1.5">
                          {tCheckout.zip ?? "Zip/Postal Code"} <span className="text-zinc-900">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.zip}
                          onChange={set("zip")}
                          placeholder={hint(form.country, "zip")}
                          className={inputCls("zip")}
                        />
                        {errors.zip && <p className="mt-1 text-xs text-red-500">{errors.zip}</p>}
                      </div>
                    </>
                  )}
                </div>

                {/* 4 — Street Address */}
                <div>
                  <label className="block text-sm text-zinc-700 mb-1.5">
                    {tCheckout.street_address ?? "Street Address"} <span className="text-zinc-900">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={set("address")}
                    placeholder={hint(form.country, "address")}
                    className={inputCls("address")}
                  />
                  {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address}</p>}
                </div>
              </div>
            </section>
          </div>

          {/* ════ RIGHT COLUMN — Order summary ════ */}
          <div className="lg:sticky lg:top-10 h-fit w-full lg:max-w-sm border-t border-zinc-100 lg:border-t-0 pt-8 lg:pt-0">
            <div className="bg-white">

              {/* Items */}
              <div className="mb-4 pb-1">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
                  {tCheckout.order_summary ?? "Order Summary"}
                </h3>
                <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
                {items.length === 0 ? (
                  <p className="py-8 text-sm text-zinc-400 text-center">{tCart.empty_state_title ?? "Your cart is empty"}</p>
                ) : (
                  items.map((item) => {
                    const resolved = resolveProductTranslation(item, locale);
                    const price = parsePrice(item.effective_price ?? item.price);
                    const img = Array.isArray(item.images) && item.images[0]?.url
                      ? item.images[0].url
                      : "/placeholder-view.svg";
                    return (
                      <div key={item.id} className="flex items-center gap-4 px-4 py-4 bg-white">
                        {/* Thumbnail */}
                        <div className="h-16 w-16 relative shrink-0 rounded-lg overflow-hidden border border-zinc-200 bg-white">
                          <Image src={img} alt={resolved.name} fill sizes="64px" loading="eager" className="object-cover" />
                        </div>
                        <div className="flex flex-1 flex-col gap-1 min-w-0">
                          <span className="text-sm font-semibold text-zinc-900 leading-snug truncate">{resolved.name}</span>
                          <span className="text-sm font-bold text-zinc-900">
                            {formatPrice(price * item.quantity)}
                          </span>
                          {/* Qty stepper + delete */}
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white px-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.quantity <= 1) removeItem(item.id);
                                  else updateQuantity(item.id, item.quantity - 1);
                                }}
                                className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="min-w-[1.5rem] text-center text-sm font-semibold text-zinc-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                disabled={item.stock != null && item.quantity >= item.stock}
                                className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              aria-label={`Remove ${resolved.name}`}
                              className="text-zinc-300 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>

              <div className="border-t border-zinc-100" />

              {/* Discount code */}
              <div className="flex items-center gap-4 py-6">
                <input
                  type="text"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder={tCheckout.discount_placeholder ?? "Discount code"}
                  className="flex-1 rounded border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
                <button
                  type="button"
                  className="text-sm font-semibold text-zinc-900 hover:text-zinc-600 transition-colors"
                >
                  {tCheckout.apply ?? "Apply"}
                </button>
              </div>

              <div className="border-t border-zinc-100" />

              {/* Totals */}
              <div className="py-6 space-y-4">
                <div className="flex justify-between text-sm text-zinc-700">
                  <span>{tCheckout.subtotal ?? "Subtotal"}</span>
                  <span className="font-medium text-zinc-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-zinc-700 items-center">
                  <span>{tCheckout.total ?? "Total"}</span>
                  <span className="text-xl font-bold text-zinc-900">{formatPrice(subtotal)}</span>
                </div>
              </div>

              {/* Place Order */}
              <div className="pt-2 pb-10">
                {errors.submit && (
                  <p className="mb-3 text-sm text-red-500 text-center">{errors.submit}</p>
                )}
                <button
                  onClick={handlePlaceOrder}
                  disabled={placing || items.length === 0}
                  className="w-full rounded-[2rem] border border-zinc-900 py-3.5 text-[13px] font-bold tracking-[0.15em] uppercase text-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {placing ? (tCheckout.placing_order ?? "Placing Order…") : (tCheckout.place_order ?? "Place Order")}
                </button>

                {/* WhatsApp order — Morocco only */}
                {form.country === "Morocco" && (
                  <button
                    type="button"
                    onClick={handleOrderWhatsApp}
                    disabled={items.length === 0}
                    className="mt-3 w-full rounded-[2rem] py-3.5 text-[13px] font-bold tracking-[0.15em] uppercase text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    {/* WhatsApp SVG icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.524 5.847L.057 23.012a.75.75 0 00.931.931l5.165-1.467A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.73 9.73 0 01-4.964-1.356l-.355-.212-3.668 1.042 1.042-3.668-.212-.355A9.73 9.73 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
                    </svg>
                  {tCheckout.order_whatsapp ?? "Order via WhatsApp"}
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
