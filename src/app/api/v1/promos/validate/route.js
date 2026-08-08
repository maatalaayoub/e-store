import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { rateLimitOrReject } from '@/lib/request-guard';
import { logger } from '@/lib/logger';
import { parsePrice } from '@/lib/price';

/**
 * POST /api/v1/promos/validate
 * Public endpoint: check whether a promo code is valid for the current cart
 * and return the discount breakdown.
 *
 * Body: { code, items: [{ id, quantity, price? }], subtotal? }
 */
export async function POST(req) {
  const limited = await rateLimitOrReject(req, {
    bucket: 'promos-validate',
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? '').trim().toUpperCase();
    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = Number(body.subtotal ?? 0);

    if (!code) {
      return NextResponse.json({ success: false, error: 'code_required' }, { status: 400 });
    }

    const db = createServiceClient();
    const { data: promo, error } = await db
      .from('promo_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !promo) {
      return NextResponse.json({ success: false, error: 'invalid_code' }, { status: 404 });
    }

    const now = new Date();
    if (!promo.is_active) {
      return NextResponse.json({ success: false, error: 'code_inactive' }, { status: 400 });
    }
    if (promo.starts_at && new Date(promo.starts_at) > now) {
      return NextResponse.json({ success: false, error: 'code_not_started' }, { status: 400 });
    }
    if (promo.expires_at && new Date(promo.expires_at) < now) {
      return NextResponse.json({ success: false, error: 'code_expired' }, { status: 400 });
    }
    if (promo.usage_limit != null && promo.used_count >= promo.usage_limit) {
      return NextResponse.json({ success: false, error: 'code_usage_limit_reached' }, { status: 400 });
    }
    if (subtotal < Number(promo.min_order_amount ?? 0)) {
      return NextResponse.json({ success: false, error: 'min_order_not_met' }, { status: 400 });
    }

    // Determine which cart items the discount applies to.
    let applicableItems = items;
    const promoProductIds = new Set((promo.product_ids ?? []).map(String));
    const promoCategoryIds = new Set((promo.category_ids ?? []).map(String));

    if (promo.applies_to === 'products') {
      applicableItems = items.filter((i) => promoProductIds.has(String(i.id)));
    } else if (promo.applies_to === 'categories') {
      if (promoCategoryIds.size > 0) {
        const productIds = items.map((i) => String(i.id));
        const { data: products } = await db
          .from('products')
          .select('id, category_id')
          .in('id', productIds);
        const eligibleIds = new Set((products ?? []).filter((p) => promoCategoryIds.has(String(p.category_id))).map((p) => String(p.id)));
        applicableItems = items.filter((i) => eligibleIds.has(String(i.id)));
      } else {
        applicableItems = [];
      }
    }

    // Scoped promo but nothing in the cart matches → reject clearly instead of
    // silently returning a 0 DH discount.
    if (promo.applies_to !== 'all' && applicableItems.length === 0) {
      return NextResponse.json({ success: false, error: 'not_applicable' }, { status: 400 });
    }

    const applicableSubtotal = applicableItems.reduce(
      (acc, item) => acc + parsePrice(item.effective_price ?? item.price) * (item.quantity ?? 1),
      0
    );
    const applicableProductIds = [...new Set(applicableItems.map((i) => String(i.id)))];

    let discountAmount = 0;
    if (promo.discount_type === 'percentage_off') {
      discountAmount = (applicableSubtotal * Number(promo.discount_value)) / 100;
      if (promo.max_discount_amount != null) {
        discountAmount = Math.min(discountAmount, Number(promo.max_discount_amount));
      }
    } else {
      discountAmount = Number(promo.discount_value);
    }

    discountAmount = Math.round(Math.min(discountAmount, applicableSubtotal) * 100) / 100;

    return NextResponse.json({
      success: true,
      data: {
        code: promo.code,
        promo_code_id: promo.id,
        discount_type: promo.discount_type,
        discount_value: Number(promo.discount_value),
        applies_to: promo.applies_to,
        discount_amount: discountAmount,
        applicable_subtotal: applicableSubtotal,
        applicable_product_ids: applicableProductIds,
        min_order_amount: Number(promo.min_order_amount ?? 0),
      },
    });
  } catch (err) {
    logger.error('POST /api/v1/promos/validate', err);
    return NextResponse.json(
      { success: false, error: 'Failed to validate promo code' },
      { status: 500 }
    );
  }
}
