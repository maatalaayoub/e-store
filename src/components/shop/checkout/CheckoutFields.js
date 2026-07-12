"use client";

/**
 * <CheckoutFields> — renders the shipping/contact form fields.
 *
 * Reused by the dedicated checkout page AND the inline checkout section,
 * so layout/copy changes propagate to both. Each field can be hidden
 * individually via the `visibleFields` prop and reordered via `fieldOrder`.
 */

import SearchableCombobox from "@/components/ui/SearchableCombobox";
import { COUNTRIES } from "@/data/countries";
import { isRtlLocale } from "@/config/constants";
import { ALL_FIELDS, hint } from "./constants";

const inputCls = (field, errors) =>
  `w-full rounded border px-3 py-2 text-sm outline-none transition-colors placeholder:text-zinc-400 ${
    errors?.[field]
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-200 bg-zinc-50/50 focus:border-zinc-400 focus:bg-white"
  }`;

function FieldLabel({ children, required }) {
  return (
    <label className="block text-sm text-zinc-700 mb-1.5">
      {children} {required && <span className="text-zinc-900">*</span>}
    </label>
  );
}

export default function CheckoutFields({
  form,
  set,
  setCountry,
  setCity,
  errors,
  cities,
  locale,
  dict,
  visibleFields,
  fieldOrder,
  // Section heading rendering — page uses ALL CAPS uppercase headings,
  // inline section keeps it simpler. Pass `headingsVariant="none"` to skip.
  headingsVariant = "page",
}) {
  const t = dict?.checkout ?? {};
  const isRtl = isRtlLocale(locale);

  // Resolve effective ordered list of visible fields.
  const order = Array.isArray(fieldOrder) && fieldOrder.length > 0 ? fieldOrder : ALL_FIELDS;
  const visible = new Set(
    Array.isArray(visibleFields) && visibleFields.length > 0 ? visibleFields : ALL_FIELDS,
  );
  const fields = order.filter((f) => visible.has(f) && ALL_FIELDS.includes(f));

  // Group: phone always rendered as "contact info", everything else as "shipping".
  const contactFields = fields.filter((f) => f === "phone");
  const shippingFields = fields.filter((f) => f !== "phone");

  const heading = (text, withRequiredMarker) =>
    headingsVariant === "page" ? (
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-900">{text}</h2>
        {withRequiredMarker && (
          <span className="text-xs text-zinc-500">{t.required_marker ?? "* Required"}</span>
        )}
      </div>
    ) : headingsVariant === "compact" ? (
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">{text}</h3>
    ) : null;

  // ── individual field renderers ─────────────────────────────────────────────
  const renderers = {
    phone: () => (
      <div key="phone">
        <FieldLabel required>{t.phone_label ?? "Phone Number"}</FieldLabel>
        <input
          type="tel"
          inputMode="numeric"
          value={form.phone}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d+]/g, "");
            set("phone")({ target: { value: raw } });
          }}
          placeholder={hint(form.country, "phone") || "+212 600 000 000"}
          dir={isRtl ? "rtl" : "ltr"}
          className={inputCls("phone", errors)}
        />
        {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
      </div>
    ),
    fullName: () => (
      <div key="fullName">
        <FieldLabel required>{t.full_name ?? "Full Name"}</FieldLabel>
        <input
          type="text"
          value={form.fullName}
          onChange={set("fullName")}
          placeholder={t.full_name_placeholder ?? "Enter your full name"}
          className={inputCls("fullName", errors)}
        />
        {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
      </div>
    ),
    country: () => (
      <div key="country">
        <FieldLabel required>{t.country ?? "Country"}</FieldLabel>
        <SearchableCombobox
          items={COUNTRIES}
          value={form.country}
          onChange={setCountry}
          placeholder={t.country_placeholder ?? "Select your country"}
          disabledMsg={t.no_countries ?? "No countries available"}
          searchPlaceholder={t.search_country ?? "Search country..."}
          isRtl={isRtl}
        />
        {errors.country && <p className="mt-1 text-xs text-red-500">{errors.country}</p>}
      </div>
    ),
    city: () => (
      <div key="city">
        <FieldLabel required>{t.city ?? "City"}</FieldLabel>
        <SearchableCombobox
          items={cities}
          value={form.city}
          onChange={setCity}
          placeholder={t.city_placeholder ?? "Select your city"}
          disabledMsg={t.select_country_first ?? "Select a country first"}
          searchPlaceholder={t.search_city ?? "Search city..."}
          isRtl={isRtl}
        />
        {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
      </div>
    ),
    state: () => form.country === "Morocco" ? null : (
      <div key="state">
        <FieldLabel>{t.state ?? "State/Province"}</FieldLabel>
        <input
          type="text"
          value={form.state}
          onChange={set("state")}
          placeholder={hint(form.country, "state")}
          className={inputCls("state", errors)}
        />
      </div>
    ),
    zip: () => form.country === "Morocco" ? null : (
      <div key="zip">
        <FieldLabel required>
          {t.zip ?? "Zip/Postal Code"}
        </FieldLabel>
        <input
          type="text"
          value={form.zip}
          onChange={set("zip")}
          placeholder={hint(form.country, "zip")}
          className={inputCls("zip", errors)}
        />
        {errors.zip && <p className="mt-1 text-xs text-red-500">{errors.zip}</p>}
      </div>
    ),
    address: () => (
      <div key="address">
        <FieldLabel required>{t.street_address ?? "Street Address"}</FieldLabel>
        <input
          type="text"
          value={form.address}
          onChange={set("address")}
          placeholder={hint(form.country, "address")}
          className={inputCls("address", errors)}
        />
        {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address}</p>}
      </div>
    ),
  };

  return (
    <div className="space-y-8">
      {contactFields.length > 0 && (
        <section>
          {heading(t.contact_info ?? "Contact Information", true)}
          <div className="space-y-5">
            {contactFields.map((f) => renderers[f]?.())}
          </div>
        </section>
      )}

      {shippingFields.length > 0 && (
        <section>
          {heading(t.shipping_address ?? "Shipping Address", false)}
          <div className="space-y-5">
            {shippingFields.map((f) => renderers[f]?.())}
          </div>
        </section>
      )}
    </div>
  );
}
