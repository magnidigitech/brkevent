import { NextRequest, NextResponse } from 'next/server';
import { getAllWards, createSpecialGuestAdmin } from '@/lib/server/dataStore';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const wards = await getAllWards();
    return NextResponse.json({ success: true, count: wards.length, wards });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch wards';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Role check: Admin only
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let adminUser = { id: 'admin-user', name: 'Event Administrator' };

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
          { success: false, message: 'Forbidden: Admin access required to add special invitees.' },
          { status: 403 }
        );
      }

      adminUser = { id: user.id, name: profile.full_name || 'Admin' };
    } else {
      const role = request.cookies.get('brk_dev_role')?.value;
      if (role === 'scanner') {
        return NextResponse.json(
          { success: false, message: 'Forbidden: Scanner staff cannot add special invitees.' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    if (!body.candidate_name || !body.candidate_name.trim()) {
      return NextResponse.json(
        { success: false, message: 'Invitee candidate name is required.' },
        { status: 400 }
      );
    }

    const result = await createSpecialGuestAdmin(body, adminUser);
    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, ward: result.ward, message: result.message }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create guest pass';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
