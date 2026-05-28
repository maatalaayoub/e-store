import { NextResponse } from 'next/server';

// Temporary diagnostic endpoint for the exact productService path used by
// /api/v1/products. Remove after production diagnosis is complete.
export async function GET() {
  const steps = [];
  const record = (label, value) => steps.push({ label, value });

  try {
    record('start', true);

    const serviceModule = await import('@/modules/products/product.service');
    record('imported product.service', Object.keys(serviceModule));

    const products = await serviceModule.productService.getProducts({
      status: 'active',
      limit: 5,
      locale: 'en',
    });
    record('productService rows', products?.length ?? 0);
    record('first product', products?.[0] ? {
      id: products[0].id,
      name: products[0].name,
      status: products[0].status,
      image: products[0].image,
      main_image: products[0].main_image,
    } : null);

    return NextResponse.json({ ok: true, steps });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      steps,
      crash: {
        name: err?.name,
        message: err?.message ?? String(err),
        code: err?.code ?? null,
        stack: err?.stack?.split('\n').slice(0, 8),
      },
    }, { status: 200 });
  }
}
