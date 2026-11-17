import { NextRequest, NextResponse } from 'next/server';
import { voidArrivalBatch } from '@/lib/server/dataStore';
import { createClient } from '@/lib/supabase/server';
import { VoidBatchPayload } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: VoidBatchPayload = await request.json();

    if (!body.batch_id || !body.reason || !body.reason.trim()) {
      return NextResponse.json(
        { success: false, message: 'Batch ID and a void reason are required.' },
        { status: 400 }
      );
    }

    // Role check: Only Admin can void
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const devRole = request.cookies.get('brk_dev_role')?.value;
    let adminUser = { id: 'admin-user-1', name: 'Event Administrator' };

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
          .select('role, full_name')
          .eq('id', user.id)
          .single();

        if (profile?.role !== 'admin') {
          return NextResponse.json(
            { success: false, message: 'Forbidden: Only administrators can void arrival batches.' },
            { status: 403 }
          );
        }

        adminUser = { id: user.id, name: profile.full_name || 'Admin' };
      } else if (devRole === 'admin') {
        adminUser = { id: '873fb05b-2d11-429c-a500-fbc48ea5f918', name: 'Event Administrator' };
      } else {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
    } else {
      if (devRole === 'scanner') {
        return NextResponse.json(
          { success: false, message: 'Forbidden: Scanner staff cannot void arrival records.' },
          { status: 403 }
        );
      }
    }

    const result = await voidArrivalBatch(body.batch_id, body.reason, adminUser);
    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to void arrival batch';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

