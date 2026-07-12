'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';

/**
 * Maps geojs country name → ISO 4217 currency code.
 * Base currency for all stored prices is MAD.
 */
export const COUNTRY_CURRENCY = {
  Morocco:              'MAD',
  'United States':      'USD',
  'United Kingdom':     'GBP',
  Canada:               'CAD',
  Australia:            'AUD',
  France:               'EUR',
  Germany:              'EUR',
  Italy:                'EUR',
  Spain:                'EUR',
  Netherlands:          'EUR',
  Belgium:              'EUR',
  Portugal:             'EUR',
  Austria:              'EUR',
  Greece:               'EUR',
  Sweden:               'SEK',
  Norway:               'NOK',
  Denmark:              'DKK',
  Switzerland:          'CHF',
  Japan:                'JPY',
  China:                'CNY',
  'South Korea':        'KRW',
  India:                'INR',
  Brazil:               'BRL',
  Mexico:               'MXN',
  'Saudi Arabia':       'SAR',
  'United Arab Emirates': 'AED',
  Qatar:                'QAR',
  Kuwait:               'KWD',
  Turkey:               'TRY',
  Egypt:                'EGP',
  'South Africa':       'ZAR',
  Nigeria:              'NGN',
  Singapore:            'SGD',
  'New Zealand':        'NZD',
  Algeria:              'DZD',
  Tunisia:              'TND',
  Senegal:              'XOF',
};

const CURRENCY_SYMBOL = {
  MAD: 'DH',
  USD: '$',
  GBP: '£',
  EUR: '€',
  CAD: 'C$',
  AUD: 'A$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  CHF: 'CHF',
  JPY: '¥',
  CNY: '¥',
  KRW: '₩',
  INR: '₹',
  BRL: 'R$',
  MXN: 'MX$',
  SAR: 'SAR',
  AED: 'AED',
  QAR: 'QAR',
  KWD: 'KWD',
  TRY: '₺',
  EGP: 'E£',
  ZAR: 'R',
  NGN: '₦',
  SGD: 'S$',
  NZD: 'NZ$',
  DZD: 'DZD',
  TND: 'TND',
  XOF: 'CFA',
};

const SESSION_KEY = 'currency_data_v1';
const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours
const FX_STALE_MS = 60 * 60 * 1000;      // warn if cache older than 1 hour

const CurrencyContext = createContext({
  currency: DEFAULT_CURRENCY,
  rate: 1,
  stale: false,
  /** @param {number} madAmount */
  formatPrice: (madAmount) => `${Number(madAmount).toFixed(2)} DH`,
  /** @param {string} country */
  setCurrencyByCountry: () => {},
});

export const DEFAULT_COUNTRY = 'Morocco';
export const DEFAULT_CURRENCY = { code: 'MAD', sym: 'DH' };

function readCachedCurrency() {
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.ts < SESSION_TTL) {
        return {
          currency: { code: parsed.code, sym: parsed.sym },
          rate: parsed.rate,
          stale: Date.now() - parsed.ts > FX_STALE_MS || parsed.stale === true,
        };
      }
    }
  } catch {/* ignore */}
  return null;
}

export default function CurrencyProvider({ children }) {
  const cached = typeof window !== 'undefined' ? readCachedCurrency() : null;
  const [currency, setCurrency] = useState(() => cached?.currency ?? DEFAULT_CURRENCY);
  /** rate = 1 MAD → N currency units */
  const [rate, setRate] = useState(() => cached?.rate ?? 1);
  const [stale, setStale] = useState(() => cached?.stale ?? false);
  const [detectedCountry, setDetectedCountry] = useState(null);
  const hasValidCache = Boolean(cached);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let cancelled = false;

    // If we already restored a valid cache, don't re-fetch until it expires.
    if (hasValidCache) return () => controller.abort();

    // Helper: fetch with hard timeout so a hung third-party can't block
    // hydration indefinitely.
    const fetchWithTimeout = (url, ms = 5000) => {
      const timer = setTimeout(() => controller.abort(), ms);
      return fetch(url, { signal }).finally(() => clearTimeout(timer));
    };

    const detect = async () => {
      try {
        // 1. Detect country via IP through our own proxy.
        const geoRes = await fetchWithTimeout('/api/v1/ip-geo', 5000);
        const geoData = geoRes.ok ? await geoRes.json() : {};
        if (cancelled) return;
        const country = geoData?.country ?? DEFAULT_COUNTRY;

        const code = COUNTRY_CURRENCY[country] ?? DEFAULT_CURRENCY.code;
        const sym  = CURRENCY_SYMBOL[code]    ?? code;

        // 2. Fetch live exchange rate (base: MAD) through our own proxy.
        let detectedRate = 1;
        let isStale = false;
        if (code !== DEFAULT_CURRENCY.code) {
          const ratesRes = await fetchWithTimeout(`/api/v1/exchange-rate?base=MAD&target=${code}`, 5000);
          const ratesData = ratesRes.ok ? await ratesRes.json() : {};
          if (cancelled) return;
          detectedRate = ratesData?.success ? ratesData.rate : 1;
          isStale = ratesData?.stale ?? false;
        }

        if (cancelled) return;
        setDetectedCountry(country);
        setCurrency({ code, sym });
        setRate(detectedRate);
        setStale(isStale);

        // Cache in sessionStorage
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            code, sym, rate: detectedRate, stale: isStale, ts: Date.now()
          }));
        } catch {/* ignore */}
      } catch (err) {
        // On any failure (timeout, API error, network unavailable), explicitly
        // fall back to Morocco / MAD so the storefront never shows USD by
        // accident.
        if (!cancelled) {
          setDetectedCountry(DEFAULT_COUNTRY);
          setCurrency(DEFAULT_CURRENCY);
          setRate(1);
          setStale(false);
        }
        if (err?.name !== 'AbortError') {
          logger.logSwallowed('CurrencyProvider detect failed', err);
        }
      }
    };

    detect().catch(() => {});
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasValidCache]);

  const setCurrencyByCountry = useCallback(async (country, opts = {}) => {
    const targetCountry = country || DEFAULT_COUNTRY;
    const code = COUNTRY_CURRENCY[targetCountry] ?? DEFAULT_CURRENCY.code;
    if (code === currency.code && targetCountry === detectedCountry) return;

    const sym = CURRENCY_SYMBOL[code] ?? code;
    let detectedRate = 1;
    let isStale = false;

    if (code !== DEFAULT_CURRENCY.code) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), opts.timeout ?? 5000);
        const res = await fetch(`/api/v1/exchange-rate?base=MAD&target=${code}`, {
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));
        const data = res.ok ? await res.json() : {};
        detectedRate = data?.success ? data.rate : 1;
        isStale = data?.stale ?? false;
      } catch (err) {
        if (err?.name !== 'AbortError') {
          logger.logSwallowed('CurrencyProvider setCurrencyByCountry failed', err);
        }
        detectedRate = 1;
        isStale = false;
      }
    }

    setDetectedCountry(targetCountry);
    setCurrency({ code, sym });
    setRate(detectedRate);
    setStale(isStale);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        code, sym, rate: detectedRate, stale: isStale, ts: Date.now(),
      }));
    } catch {/* ignore */}
  }, [currency.code, detectedCountry]);

  const value = useMemo(() => ({
    currency,
    rate,
    stale,
    detectedCountry,
    setCurrencyByCountry,
    formatPrice: (madAmount) => {
      if (madAmount == null) return '';
      const num = Number(String(madAmount).replace(/[^0-9.]/g, '')) || 0;
      const converted = num * rate;
      return `\u200E${converted.toFixed(2)} ${currency.sym}`;
    },
  }), [currency, rate, stale, detectedCountry, setCurrencyByCountry]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

/** Returns `{ currency, rate, stale, formatPrice }` */
export function useCurrency() {
  return useContext(CurrencyContext);
}
