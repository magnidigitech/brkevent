import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserProfile } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ authenticated: false, profile: null }, { status: 401 });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const userProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        full_name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Staff User',
        role: (profile?.role as 'admin' | 'scanner') || 'scanner',
      };

      return NextResponse.json({ authenticated: true, profile: userProfile });
    }

    // Development fallback profile (allows testing in local environment when Supabase keys are pending)
    const roleCookie = request.cookies.get('brk_dev_role')?.value;
    const role = (roleCookie === 'scanner' ? 'scanner' : 'admin') as 'admin' | 'scanner';

    const devProfile: UserProfile = {
      id: 'dev-staff-1',
      email: role === 'admin' ? 'admin@bhashyamramakrishna.in' : 'scanner1@bhashyamramakrishna.in',
      full_name: role === 'admin' ? 'Event Administrator' : 'Gate Scanner 1',
      role,
    };

    return NextResponse.json({ authenticated: true, profile: devProfile });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication check failed';
    return NextResponse.json({ authenticated: false, error: message }, { status: 500 });
  }
}
