import { NextRequest, NextResponse } from 'next/server';
import { recordArrival } from '@/lib/server/dataStore';
import { createClient } from '@/lib/supabase/server';
import { RecordArrivalPayload } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: RecordArrivalPayload = await request.json();

    if (!body.ward_id || !body.batch_size || !body.request_id) {
      return NextResponse.json(
        { success: false, message: 'ward_id, batch_size, and request_id are required.' },
        { status: 400 }
      );
    }

    if (typeof body.batch_size !== 'number' || body.batch_size <= 0 || !Number.isInteger(body.batch_size)) {
      return NextResponse.json(
        { success: false, message: 'Batch size must be a positive integer.' },
        { status: 400 }
      );
    }

    // Identify the staff member recording this arrival
    let staffUser = {
      id: 'staff-user-1',
      name: 'Gate Scanner 1',
      email: 'scanner1@bhashyamramakrishna.in',
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const devRole = request.cookies.get('brk_dev_role')?.value;

    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      const supabase = await createClient();
      let user = null;
      try {
        const { data } = await supabase.auth.getUser();
        user = data?.user || null;
      } catch {
        user = null;
      }

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .single();

        staffUser = {
          id: user.id,
          name: profile?.full_name || user.email?.split('@')[0] || 'Staff Member',
          email: user.email || '',
        };
      } else if (devRole) {
        // Authenticated via cookie/PIN/biometric session
        const isAdmin = devRole === 'admin';
        staffUser = {
          id: isAdmin ? '873fb05b-2d11-429c-a500-fbc48ea5f918' : '68d8be10-4b2e-4070-95c9-2b51a20fe8e4',
          name: isAdmin ? 'Event Administrator' : 'Gate Scanner 1',
          email: isAdmin ? 'admin@bhashyamramakrishna.in' : 'scanner1@bhashyamramakrishna.in',
        };
      } else {
        return NextResponse.json({ success: false, message: 'Unauthorized. Please log in.' }, { status: 401 });
      }
    } else {
      if (!devRole) {
        return NextResponse.json({ success: false, message: 'Unauthorized. Please log in.' }, { status: 401 });
      }
      staffUser = {
        id: devRole === 'admin' ? 'admin-user-1' : 'scanner-user-1',
        name: devRole === 'admin' ? 'Event Administrator' : 'Gate Scanner 1',
        email: devRole === 'admin' ? 'admin@bhashyamramakrishna.in' : 'scanner1@bhashyamramakrishna.in',
      };
    }

    const result = await recordArrival(body, staffUser);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record arrival';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

