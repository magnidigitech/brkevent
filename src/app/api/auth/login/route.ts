import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password, devRole } = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, user: data.user });
    }

    // Local development fallback
    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully (Dev Mode)',
      user: { email, role: devRole || (email.includes('admin') ? 'admin' : 'scanner') },
    });

    response.cookies.set('brk_dev_role', devRole || (email.includes('admin') ? 'admin' : 'scanner'), {
      path: '/',
      httpOnly: false,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

