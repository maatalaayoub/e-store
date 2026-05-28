import { NextResponse } from 'next/server';

// Temporary diagnostic endpoint — isolates each step that runs inside
// /api/v1/products GET so we can see exactly where it crashes on Vercel.
export async function GET() {
  const steps = [];
  const record = (label, value) => steps.push({ label, value });

  try {
    record('env.NODE_ENV', process.env.NODE_ENV ?? null);
    record('has NEXT_PUBLIC_SUPABASE_URL', Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL));
    record('NEXT_PUBLIC_SUPABASE_URL', (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^(https?:\/\/[^.]{4}).*/, '$1***'));
    record('has NEXT_PUBLIC_SUPABASE_ANON_KEY', Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
    record('has SUPABASE_SERVICE_ROLE_KEY', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));

    const { createClient } = await import('@/lib/supabase/server');
    record('imported supabase/server', true);

    const supabase = await createClient();
    record('created supabase client', true);

    const { data, error } = await supabase
      .from('products')
      .select('id, name, status')
      .eq('status', 'active')
      .limit(3);

    if (error) {
      record('query error', { message: error.message, code: error.code, hint: error.hint, details: error.details });
    } else {
      record('query rows', data?.length ?? 0);
      record('first row', data?.[0] ?? null);
    }

    return NextResponse.json({ ok: !error, steps });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      steps,
      crash: {
        name: err?.name,
        message: err?.message ?? String(err),
        stack: err?.stack?.split('\n').slice(0, 5),
      },
    }, { status: 200 });
  }
}
