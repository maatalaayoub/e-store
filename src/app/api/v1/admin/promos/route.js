import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminUser } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { logger } from '@/lib/logger';

const DISCOUNT_TYPES = new Set(['percentage_off', 'fixed_amount']);
const APPLIES_TO = new Set(['all', 'products', 'categories']);
const CODE_RE = /^[A-Z0-9_-]{3,30}$/i;

function toArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function cleanUUIDs(value) {
  const arr = toArray(value).filter(Boolean);
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return [...new Set(arr.map(String).filter((v) => re.test(v)))];
}

function promoShape(row) {
  return {
    id: row.id,
    code: row.code,
    discount_type: row.discount_type,
    discount_value: Number(row.discount_value ?? 0),
    min_order_amount: Number(row.min_order_amount ?? 0),
    max_order_amount: row.max_order_amount != null ? Number(row.max_order_amount) : null,
    starts_at: row.starts_at ?? null,
    expires_at: row.expires_at ?? null,
    usage_limit: row.usage_limit ?? null,
    used_count: Number(row.used_count ?? 0),
    applies_to: row.applies_to,
    product_ids: Array.isArray(row.product_ids) ? row.product_ids : [],
    category_ids: Array.isArray(row.category_ids) ? row.category_ids : [],
    is_active: row.is_active,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function GET(req) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase, 'products');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

    const db = createServiceClient();
    let query = db
      .from('promo_codes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map(promoShape),
      count: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('GET /api/v1/admin/promos', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load promo codes' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, {
    bucket: 'admin-promos-write',
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase, 'products');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? '').trim().toUpperCase();
    const discountType = body.discount_type ?? 'percentage_off';
    const discountValue = Number(body.discount_value);
    const minOrderAmount = Number(body.min_order_amount ?? 0);
    const maxOrderAmount = body.max_order_amount != null ? Number(body.max_order_amount) : null;
    const startsAt = body.starts_at || null;
    const expiresAt = body.expires_at || null;
    const usageLimit = body.usage_limit != null ? Number(body.usage_limit) : null;
    const appliesTo = body.applies_to ?? 'all';
    const productIds = cleanUUIDs(body.product_ids);
    const categoryIds = cleanUUIDs(body.category_ids);

    if (!CODE_RE.test(code)) {
      return NextResponse.json({ success: false, error: 'invalid_code' }, { status: 400 });
    }
    if (!DISCOUNT_TYPES.has(discountType)) {
      return NextResponse.json({ success: false, error: 'invalid_discount_type' }, { status: 400 });
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return NextResponse.json({ success: false, error: 'invalid_discount_value' }, { status: 400 });
    }
    if (discountType === 'percentage_off' && discountValue > 100) {
      return NextResponse.json({ success: false, error: 'percentage_too_high' }, { status: 400 });
    }
    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
      return NextResponse.json({ success: false, error: 'invalid_min_order_amount' }, { status: 400 });
    }
    if (maxOrderAmount != null && (!Number.isFinite(maxOrderAmount) || maxOrderAmount < 0)) {
      return NextResponse.json({ success: false, error: 'invalid_max_order_amount' }, { status: 400 });
    }
    if (maxOrderAmount != null && maxOrderAmount < minOrderAmount) {
      return NextResponse.json({ success: false, error: 'invalid_max_order_amount' }, { status: 400 });
    }
    if (!APPLIES_TO.has(appliesTo)) {
      return NextResponse.json({ success: false, error: 'invalid_applies_to' }, { status: 400 });
    }
    if (appliesTo === 'products' && productIds.length === 0) {
      return NextResponse.json({ success: false, error: 'product_ids_required' }, { status: 400 });
    }
    if (appliesTo === 'categories' && categoryIds.length === 0) {
      return NextResponse.json({ success: false, error: 'category_ids_required' }, { status: 400 });
    }
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) {
      return NextResponse.json({ success: false, error: 'invalid_date_range' }, { status: 400 });
    }

    const db = createServiceClient();
    const { data, error } = await db
      .from('promo_codes')
      .insert({
        code,
        discount_type: discountType,
        discount_value: discountValue,
        min_order_amount: minOrderAmount,
        max_order_amount: maxOrderAmount,
        starts_at: startsAt,
        expires_at: expiresAt,
        usage_limit: usageLimit,
        applies_to: appliesTo,
        product_ids: productIds,
        category_ids: categoryIds,
        is_active: body.is_active !== false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: 'code_already_exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data: promoShape(data) }, { status: 201 });
  } catch (err) {
    logger.error('POST /api/v1/admin/promos', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create promo code' },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, {
    bucket: 'admin-promos-write',
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase, 'products');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? '').trim();
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!re.test(id)) {
      return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
    }

    const update = {};
    if (body.code !== undefined) {
      const code = String(body.code).trim().toUpperCase();
      if (!CODE_RE.test(code)) return NextResponse.json({ success: false, error: 'invalid_code' }, { status: 400 });
      update.code = code;
    }
    if (body.discount_type !== undefined) {
      if (!DISCOUNT_TYPES.has(body.discount_type)) return NextResponse.json({ success: false, error: 'invalid_discount_type' }, { status: 400 });
      update.discount_type = body.discount_type;
    }
    if (body.discount_value !== undefined) {
      const v = Number(body.discount_value);
      if (!Number.isFinite(v) || v <= 0) return NextResponse.json({ success: false, error: 'invalid_discount_value' }, { status: 400 });
      update.discount_value = v;
    }
    if (body.min_order_amount !== undefined) {
      const v = Number(body.min_order_amount);
      if (!Number.isFinite(v) || v < 0) return NextResponse.json({ success: false, error: 'invalid_min_order_amount' }, { status: 400 });
      update.min_order_amount = v;
    }
    if (body.max_order_amount !== undefined) {
      const v = body.max_order_amount === null ? null : Number(body.max_order_amount);
      if (v !== null && (!Number.isFinite(v) || v < 0)) return NextResponse.json({ success: false, error: 'invalid_max_order_amount' }, { status: 400 });
      update.max_order_amount = v;
    }
    if (body.starts_at !== undefined) update.starts_at = body.starts_at || null;
    if (body.expires_at !== undefined) update.expires_at = body.expires_at || null;
    if (body.usage_limit !== undefined) {
      update.usage_limit = body.usage_limit === null ? null : Number(body.usage_limit);
      if (update.usage_limit != null && (!Number.isFinite(update.usage_limit) || update.usage_limit <= 0)) {
        return NextResponse.json({ success: false, error: 'invalid_usage_limit' }, { status: 400 });
      }
    }
    if (body.applies_to !== undefined) {
      if (!APPLIES_TO.has(body.applies_to)) return NextResponse.json({ success: false, error: 'invalid_applies_to' }, { status: 400 });
      update.applies_to = body.applies_to;
    }
    if (body.product_ids !== undefined) update.product_ids = cleanUUIDs(body.product_ids);
    if (body.category_ids !== undefined) update.category_ids = cleanUUIDs(body.category_ids);
    if (body.is_active !== undefined) update.is_active = !!body.is_active;

    if (update.discount_type === 'percentage_off' && update.discount_value > 100) {
      return NextResponse.json({ success: false, error: 'percentage_too_high' }, { status: 400 });
    }

    if (update.starts_at && update.expires_at && new Date(update.starts_at) >= new Date(update.expires_at)) {
      return NextResponse.json({ success: false, error: 'invalid_date_range' }, { status: 400 });
    }
    if (update.applies_to === 'products' && update.product_ids?.length === 0) {
      return NextResponse.json({ success: false, error: 'product_ids_required' }, { status: 400 });
    }
    if (update.applies_to === 'categories' && update.category_ids?.length === 0) {
      return NextResponse.json({ success: false, error: 'category_ids_required' }, { status: 400 });
    }

    const db = createServiceClient();
    const { data, error } = await db
      .from('promo_codes')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: 'code_already_exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data: promoShape(data) });
  } catch (err) {
    logger.error('PATCH /api/v1/admin/promos', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update promo code' },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, {
    bucket: 'admin-promos-write',
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase, 'products');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get('id') ?? '').trim();
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!re.test(id)) {
      return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
    }

    const db = createServiceClient();
    const { error } = await db.from('promo_codes').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('DELETE /api/v1/admin/promos', err);
    return NextResponse.json(
      { success: false, error: 'Failed to delete promo code' },
      { status: 500 }
    );
  }
}
