/**
 * Checkout constants — used by the checkout page AND the inline checkout
 * section so both surfaces share the same per-country hints.
 */

export const COUNTRY_HINTS = {
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

export const hint = (country, field) => COUNTRY_HINTS[country]?.[field] ?? "";

/** Canonical field order + the full set of supported fields. */
export const ALL_FIELDS = ["phone", "fullName", "country", "city", "state", "zip", "address"];
