"use client";

/**
 * <CheckoutActions> — Place Order + WhatsApp buttons.
 *
 * Either button can be hidden via `showPlaceOrder` / `showWhatsApp`.
 * Used by both the dedicated checkout page and the inline checkout section.
 */

const DEFAULT_REQUIRED = ["phone", "fullName", "address", "city", "country"];

export default function CheckoutActions({
  dict,
  placing,
  errors,
  form,
  requiredFields,
  itemsCount,
  country,
  showPlaceOrder = true,
  showWhatsApp = true,
  whatsAppCountriesOnly = ["Morocco"],   // null = always show
  onPlaceOrder,
  onOrderWhatsApp,
  orderBtnStyle,   // optional inline style override from section config
  waBtnStyle,      // optional inline style override from section config
}) {
  const t = dict?.checkout ?? {};
  const disabled = placing || itemsCount === 0;
  const showWaButton =
    showWhatsApp &&
    (whatsAppCountriesOnly === null || whatsAppCountriesOnly.includes(country));

  if (!showPlaceOrder && !showWaButton) return null;

  // Only show the validation banner after user has attempted to submit
  const hasAttempted = errors && Object.values(errors).some(Boolean);

  const FIELD_LABELS = {
    phone:    t.phone_label    ?? "Phone Number",
    fullName: t.full_name      ?? "Full Name",
    country:  t.country        ?? "Country",
    city:     t.city           ?? "City",
    state:    t.state          ?? "State/Province",
    zip:      t.zip            ?? "Zip/Postal Code",
    address:  t.street_address ?? "Street Address",
  };

  // Compute missing fields from live form data (not from errors state)
  const moroccoOptional = form?.country === "Morocco" ? ["zip", "state"] : [];
  const required = Array.isArray(requiredFields) && requiredFields.length > 0
    ? requiredFields
    : DEFAULT_REQUIRED;
  const missingFields = hasAttempted && form
    ? required
        .filter((f) => !moroccoOptional.includes(f) && !String(form[f] ?? "").trim() && FIELD_LABELS[f])
        .map((f) => FIELD_LABELS[f])
    : [];

  const fillRequiredMsg =
    missingFields.length > 0
      ? (t.fill_required ?? "Please fill in the required fields: {fields}").replace(
          "{fields}",
          missingFields.join(", "),
        )
      : null;

  return (
    <div>
      {fillRequiredMsg && (
        <p className="mb-3 text-sm text-red-500 text-center">{fillRequiredMsg}</p>
      )}
      {errors?.submit && (
        <p className="mb-3 text-sm text-red-500 text-center">{errors.submit}</p>
      )}
      {showPlaceOrder && (
        <button
          type="button"
          data-role="order-btn"
          onClick={onPlaceOrder}
          disabled={disabled}
          className="w-full rounded-[2rem] border border-zinc-900 py-3.5 text-[13px] font-bold tracking-[0.15em] uppercase text-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={orderBtnStyle}
        >
          {placing ? (t.placing_order ?? "Placing Order…") : (t.place_order ?? "Place Order")}
        </button>
      )}
      {showWaButton && (
        <button
          type="button"
          data-role="whatsapp-btn"
          onClick={onOrderWhatsApp}
          disabled={itemsCount === 0}
          className={`${showPlaceOrder ? "mt-3" : ""} w-full rounded-[2rem] py-3.5 text-[13px] font-bold tracking-[0.15em] uppercase text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          style={{ backgroundColor: "#25D366", ...waBtnStyle }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.524 5.847L.057 23.012a.75.75 0 00.931.931l5.165-1.467A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.73 9.73 0 01-4.964-1.356l-.355-.212-3.668 1.042 1.042-3.668-.212-.355A9.73 9.73 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
          </svg>
          {t.order_whatsapp ?? "Order via WhatsApp"}
        </button>
      )}
    </div>
  );
}
