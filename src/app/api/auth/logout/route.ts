import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      const supabase = await createClient();
      await supabase.auth.signOut();
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.delete('brk_dev_role');
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Logout failed';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

