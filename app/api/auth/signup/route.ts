import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { email, password, tier } = await req.json();
  const resolvedTier = typeof tier === 'string' && tier.trim() !== '' ? tier : 'diy';

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Bootstrap user_credits so /dashboard renders for the new user. Without
  // this row, the dashboard's score/tier/removed_count panels stay empty
  // and tier-gated UI defaults silently. Uses the service-role key to
  // bypass RLS — this is a server-only route, the key never reaches the
  // client.
  const userId = authData.user?.id;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (userId && serviceKey) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
    );
    const { error: bootstrapError } = await admin
      .from('user_credits')
      .insert({ id: userId, tier: resolvedTier });
    // Duplicate inserts (e.g. user retries after a transient error) are
    // fine — the row already exists. Anything else is logged but doesn't
    // block signup; the dashboard tolerates a missing row.
    if (
      bootstrapError &&
      !/duplicate key|unique constraint|already exists/i.test(bootstrapError.message)
    ) {
      console.error(
        '[signup] user_credits bootstrap failed:',
        bootstrapError.message,
      );
    }
  } else if (userId && !serviceKey) {
    console.warn(
      '[signup] SUPABASE_SERVICE_ROLE_KEY not set — skipping user_credits bootstrap. Dashboard will render with defaults until the row exists.',
    );
  }

  return NextResponse.json({
    user: authData.user,
    session: authData.session,
  });
}
