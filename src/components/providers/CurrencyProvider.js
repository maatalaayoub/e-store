'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Maps geojs country name → ISO 4217 currency code.
 * Base currency for all stored prices is MAD.
 */
const COUNTRY_CURRENCY = {
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
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

const CurrencyContext = createContext({
  currency: { code: 'MAD', sym: 'DH' },
  /** @param {number} madAmount */
  formatPrice: (madAmount) => `${Number(madAmount).toFixed(2)} DH`,
});

export default function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState({ code: 'MAD', sym: 'DH' });
  /** rate = 1 MAD → N currency units */
  const [rate, setRate] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    // Try to restore from sessionStorage first
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < SESSION_TTL) {
          setCurrency({ code: parsed.code, sym: parsed.sym });
          setRate(parsed.rate);
          return () => controller.abort();
        }
      }
    } catch {/* ignore */}

    const detect = async () => {
      try {
        // 1. Detect country via IP
        const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal });
        const geoData = geoRes.ok ? await geoRes.json() : {};
        const country = geoData?.country ?? 'Morocco';

        const code = COUNTRY_CURRENCY[country] ?? 'MAD';
        const sym  = CURRENCY_SYMBOL[code]    ?? code;

        // 2. Fetch live exchange rate (base: MAD)
        let detectedRate = 1;
        if (code !== 'MAD') {
          const ratesRes = await fetch('https://open.er-api.com/v6/latest/MAD', { signal });
          const ratesData = ratesRes.ok ? await ratesRes.json() : {};
          detectedRate = ratesData?.rates?.[code] ?? 1;
        }

        setCurrency({ code, sym });
        setRate(detectedRate);

        // Cache in sessionStorage
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code, sym, rate: detectedRate, ts: Date.now() }));
        } catch {/* ignore */}
      } catch (err) {
        // Silently ignore abort errors (React Strict Mode / component unmount)
        if (err?.name !== 'AbortError') {
          // fallback to MAD — already the default state
        }
      }
    };

    detect().catch(() => {});
    return () => controller.abort();
  }, []);

  const value = useMemo(() => ({
    currency,
    rate,
    formatPrice: (madAmount) => {
      if (madAmount == null) return '';
      const num = Number(String(madAmount).replace(/[^0-9.]/g, '')) || 0;
      const converted = num * rate;
      return `\u200E${converted.toFixed(2)} ${currency.sym}`;
    },
  }), [currency, rate]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

/** Returns `{ currency, formatPrice }` */
export function useCurrency() {
  return useContext(CurrencyContext);
}
