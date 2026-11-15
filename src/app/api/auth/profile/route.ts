import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserProfile } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let user = null;
    let profile = null;

    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      const supabase = await createClient();
      const authRes = await supabase.auth.getUser();
      user = authRes.data?.user || null;

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        profile = profileData;
      }
    }

    if (user) {
      const userProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        full_name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Staff User',
        role: (profile?.role as 'admin' | 'scanner') || 'scanner',
      };

      return NextResponse.json({ authenticated: true, profile: userProfile });
    }

    // Development / fallback session check
    const roleCookie = request.cookies.get('brk_dev_role')?.value;
    if (roleCookie) {
      const role = (roleCookie === 'scanner' ? 'scanner' : 'admin') as 'admin' | 'scanner';

      const devProfile: UserProfile = {
        id: 'dev-staff-1',
        email: role === 'admin' ? 'vivek@bhashyamramakrishna.in' : 'scanner1@bhashyamramakrishna.in',
        full_name: role === 'admin' ? 'Venkata Vivek' : 'Gate Scanner 1',
        role,
      };

      return NextResponse.json({ authenticated: true, profile: devProfile });
    }

    return NextResponse.json({ authenticated: false, profile: null }, { status: 401 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication check failed';
    return NextResponse.json({ authenticated: false, error: message }, { status: 500 });
  }
}

