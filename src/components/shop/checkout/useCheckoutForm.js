"use client";

/**
 * Shared checkout form hook.
 *
 * Single source of truth for:
 *   - form state + per-field setters
 *   - hydration guard (SSR-safe)
 *   - IP-based country detection
 *   - logged-in profile autofill
 *   - country/city dropdown derivation (country-state-city offline data)
 *   - validation
 *   - place-order POST + WhatsApp message builder
 *
 * Both the dedicated checkout page (`CheckoutClient`) and the inline
 * checkout section on a product page consume this hook. Keep all checkout
 * logic here so future improvements automatically apply to both.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { findCountry, detectCountryFromIp } from "@/data/countries";
import { resolveProductTranslation } from "@/lib/product-locale";
import { parsePrice } from "@/lib/price";
import { WHATSAPP_NUMBER } from "@/config/constants";

const INITIAL_FORM = {
  phone: "",
  fullName: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  country: "Morocco",
};

/**
 * @param {object}   opts
 * @param {Array}    opts.items                — line items (cart items OR a single product wrapped in an array)
 * @param {number}   opts.subtotal             — pre-computed subtotal in MAD
 * @param {string}   opts.locale
 * @param {object}   opts.currency             — { code }
 * @param {number}   opts.rate                 — exchange rate
 * @param {(price:number)=>string} opts.formatPrice
 * @param {(orderId:string)=>void} [opts.onOrderSuccess]
 * @param {string[]} [opts.requiredFields]     — defaults to all visible required fields
 */
export function useCheckoutForm({
  items,
  subtotal,
  locale,
  currency,
  rate,
  formatPrice,
  onOrderSuccess,
  requiredFields,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [placing, setPlacing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  /* ── Autofill: IP country + logged-in profile ───────────────────────────── */
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

    setHydrated(true);
    fetchCountry();
    fetchProfile();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  /* ── Field setter helpers ───────────────────────────────────────────────── */
  const set = useCallback(
    (field) => (e) => {
      const value = e?.target ? e.target.value : e;
      setForm((f) => ({ ...f, [field]: value }));
      setErrors((err) => ({ ...err, [field]: undefined }));
    },
    [],
  );

  const setCountry = useCallback((val) => {
    setForm((f) => ({ ...f, country: val, city: "", state: "", zip: "" }));
    setErrors((err) => ({ ...err, country: undefined, city: undefined, zip: undefined }));
  }, []);

  const setCity = useCallback((val) => {
    setForm((f) => ({ ...f, city: val }));
    setErrors((err) => ({ ...err, city: undefined }));
  }, []);

  /* ── Country / city derivation ──────────────────────────────────────────── */
  const selectedIso = useMemo(
    () => findCountry(form.country)?.isoCode ?? null,
    [form.country],
  );

  // `country-state-city` is ~200 KB sync. Defer it until the user actually
  // picks a country so it never lands in the initial bundle.
  const [cities, setCities] = useState([]);
  useEffect(() => {
    if (!selectedIso) { setCities([]); return; }
    let cancelled = false;
    import("country-state-city").then(({ City }) => {
      if (cancelled) return;
      const names = (City.getCitiesOfCountry(selectedIso) ?? []).map((c) => c.name);
      setCities(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
    }).catch(() => { if (!cancelled) setCities([]); });
    return () => { cancelled = true; };
  }, [selectedIso]);

  /* ── Validation ─────────────────────────────────────────────────────────── */
  // `requiredFields` lets the inline checkout opt out of validating fields
  // that the admin has hidden (e.g. hide state/zip in a Morocco-only flow).
  const validate = useCallback(() => {
    const moroccoOptional = form.country === "Morocco" ? ["zip", "state"] : [];
    const required = Array.isArray(requiredFields) && requiredFields.length > 0
      ? requiredFields
      : ["phone", "fullName", "address", "city", "country"];
    const e = {};
    for (const f of required) {
      if (moroccoOptional.includes(f)) continue;
      if (!String(form[f] ?? "").trim()) e[f] = "Required";
    }
    return e;
  }, [form, requiredFields]);

  /* ── Submit handlers ────────────────────────────────────────────────────── */
  const handlePlaceOrder = useCallback(async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (!Array.isArray(items) || items.length === 0) return;
    if (placing) return; // double-submit guard
    setPlacing(true);
    // Stable idempotency key for this submit. A network retry inside the
    // same submit attempt reuses it; a fresh submit gets a new key.
    const idempotencyKey =
      (globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
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
          // unit_price_mad / total_mad are accepted by the server for backward
          // compatibility but ignored — pricing is recomputed server-side from
          // the canonical products table. We send them anyway for telemetry.
          items: items.map((item) => ({
            id: item.id,
            quantity: item.quantity ?? 1,
            selected_color: item.selectedColor ?? item.selected_color ?? null,
            selected_size:  item.selectedSize  ?? item.selected_size  ?? null,
          })),
          currency_code: currency?.code,
          exchange_rate: rate,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        const message = json.error || `Order failed (${res.status})`;
        throw new Error(message);
      }
      onOrderSuccess?.(json.data.id);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        submit: err?.message || "Failed to place order. Please try again.",
      }));
    } finally {
      setPlacing(false);
    }
  }, [validate, items, form, currency, rate, onOrderSuccess, placing]);

  const handleOrderWhatsApp = useCallback(() => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (!Array.isArray(items) || items.length === 0) return;
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
        const qty = item.quantity ?? 1;
        const color = item.selectedColor?.name ?? item.selected_color?.name ?? null;
        const size  = item.selectedSize ?? item.selected_size ?? null;
        const variantParts = [];
        if (color) variantParts.push(`Color: ${color}`);
        if (size)  variantParts.push(`Size: ${size}`);
        const variantSuffix = variantParts.length ? `\n   ↳ ${variantParts.join(' • ')}` : '';
        return `- ${resolved.name} x${qty} = ${formatPrice(price * qty)}${variantSuffix}`;
      }),
      ``,
      `*Total: ${formatPrice(subtotal)}*`,
    ];
    const msg = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank", "noopener,noreferrer");
  }, [validate, items, form, subtotal, formatPrice, locale]);

  return {
    form,
    setForm,
    set,
    setCountry,
    setCity,
    errors,
    setErrors,
    placing,
    hydrated,
    cities,
    selectedIso,
    handlePlaceOrder,
    handleOrderWhatsApp,
  };
}
