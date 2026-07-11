/* ─────────────────────────────────────────────────────────────
   Shared country list with ISO codes for reliable IP detection
   Used by Account Settings and Checkout pages
───────────────────────────────────────────────────────────── */
export const COUNTRIES = [
  // North Africa
  { value: "Morocco",        isoCode: "MA", label: "Morocco 🇲🇦" },
  { value: "Algeria",        isoCode: "DZ", label: "Algeria 🇩🇿" },
  { value: "Tunisia",        isoCode: "TN", label: "Tunisia 🇹🇳" },
  { value: "Libya",          isoCode: "LY", label: "Libya 🇱🇾" },
  { value: "Egypt",          isoCode: "EG", label: "Egypt 🇪🇬" },
  // Europe
  { value: "France",         isoCode: "FR", label: "France 🇫🇷" },
  { value: "Germany",        isoCode: "DE", label: "Germany 🇩🇪" },
  { value: "United Kingdom", isoCode: "GB", label: "United Kingdom 🇬🇧" },
  { value: "Italy",          isoCode: "IT", label: "Italy 🇮🇹" },
  { value: "Spain",          isoCode: "ES", label: "Spain 🇪🇸" },
  { value: "Netherlands",    isoCode: "NL", label: "Netherlands 🇳🇱" },
  { value: "Belgium",        isoCode: "BE", label: "Belgium 🇧🇪" },
  { value: "Sweden",         isoCode: "SE", label: "Sweden 🇸🇪" },
  { value: "Norway",         isoCode: "NO", label: "Norway 🇳🇴" },
  { value: "Denmark",        isoCode: "DK", label: "Denmark 🇩🇰" },
  { value: "Finland",        isoCode: "FI", label: "Finland 🇫🇮" },
  { value: "Switzerland",    isoCode: "CH", label: "Switzerland 🇨🇭" },
  { value: "Austria",        isoCode: "AT", label: "Austria 🇦🇹" },
  { value: "Portugal",       isoCode: "PT", label: "Portugal 🇵🇹" },
  { value: "Poland",         isoCode: "PL", label: "Poland 🇵🇱" },
  { value: "Czech Republic", isoCode: "CZ", label: "Czech Republic 🇨🇿" },
  { value: "Romania",        isoCode: "RO", label: "Romania 🇷🇴" },
  { value: "Hungary",        isoCode: "HU", label: "Hungary 🇭🇺" },
  { value: "Greece",         isoCode: "GR", label: "Greece 🇬🇷" },
  { value: "Ireland",        isoCode: "IE", label: "Ireland 🇮🇪" },
  { value: "Croatia",        isoCode: "HR", label: "Croatia 🇭🇷" },
  { value: "Slovakia",       isoCode: "SK", label: "Slovakia 🇸🇰" },
  { value: "Bulgaria",       isoCode: "BG", label: "Bulgaria 🇧🇬" },
  { value: "Serbia",         isoCode: "RS", label: "Serbia 🇷🇸" },
  { value: "Ukraine",        isoCode: "UA", label: "Ukraine 🇺🇦" },
  // North America
  { value: "United States",  isoCode: "US", label: "United States 🇺🇸" },
  { value: "Canada",         isoCode: "CA", label: "Canada 🇨🇦" },
  { value: "Mexico",         isoCode: "MX", label: "Mexico 🇲🇽" },
];

/** Find country meta by its `value` (display name). */
export const findCountry = (value) =>
  COUNTRIES.find((c) => c.value === value) ?? null;

/** Find country meta by ISO 3166-1 alpha-2 code (e.g. "MA"). */
export const findCountryByIso = (iso) =>
  COUNTRIES.find((c) => c.isoCode === iso) ?? null;

/**
 * Detect user country via IP geolocation.
 * Returns the country `value` (e.g. "Morocco") or null if detection failed
 * or the country isn't in our supported list.
 *
 * Uses `country_code` (ISO alpha-2) — far more reliable than matching the
 * full country name string returned by the API.
 */
export async function detectCountryFromIp(signal) {
  try {
    const res = await fetch("/api/v1/ip-geo", { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const code = data?.country_code;
    return findCountryByIso(code)?.value ?? null;
  } catch {
    return null;
  }
}
