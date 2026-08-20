import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isStripeConnected } from '@/lib/stripe/connection';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/checkout/payment-config
 * Public. Exposes only the non-sensitive flags the storefront checkout needs to
 * decide which order methods to render. No secrets, keys, or account ids.
 *
 * Online (Stripe) payment is offered only when it is both enabled by the admin
 * AND a Stripe account is actually connected.
 */
export async function GET() {
  const fallback = {
    cod_enabled: true,
    whatsapp_enabled: false,
    whatsapp_number: '',
    whatsapp_all_countries: false,
    online_enabled: false,
    stripe_enabled: false,
  };

  try {
    const db = createServiceClient();
    const [{ data: rows }, stripeConnected] = await Promise.all([
      db
        .from('store_settings')
        .select('key, value')
        .in('key', [
          'payments_cod_enabled',
          'order_whatsapp_enabled',
          'order_whatsapp_number',
          'order_whatsapp_all_countries',
          'order_online_enabled',
        ]),
      isStripeConnected(),
    ]);

    const settings = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
    const isOn = (key, dflt) =>
      settings[key] === undefined ? dflt : settings[key] === 'true';

    const onlineEnabled = isOn('order_online_enabled', true);

    return NextResponse.json({
      success: true,
      data: {
        cod_enabled: isOn('payments_cod_enabled', true),
        whatsapp_enabled: isOn('order_whatsapp_enabled', false),
        whatsapp_number: settings.order_whatsapp_number ?? '',
        whatsapp_all_countries: isOn('order_whatsapp_all_countries', false),
        online_enabled: onlineEnabled,
        stripe_enabled: onlineEnabled && stripeConnected,
      },
    });
  } catch (err) {
    logger.warn('GET /api/v1/checkout/payment-config', err);
    return NextResponse.json({ success: true, data: fallback });
  }
}
