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
    let adminUser = { id: 'admin-user-1', name: 'Event Administrator' };

    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

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
    } else {
      const devRole = request.cookies.get('brk_dev_role')?.value;
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
