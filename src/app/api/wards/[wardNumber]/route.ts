import { NextRequest, NextResponse } from 'next/server';
import { getWardByNumber, updateWardAdmin } from '@/lib/server/dataStore';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wardNumber: string }> }
) {
  try {
    const { wardNumber: rawWard } = await params;
    const wardNumber = parseInt(rawWard, 10);

    if (isNaN(wardNumber) || wardNumber < 1 || wardNumber > 76) {
      return NextResponse.json(
        { success: false, message: `Division number ${rawWard} is invalid. Divisions must be 1 to 76.` },
        { status: 400 }
      );
    }

    const ward = await getWardByNumber(wardNumber);
    if (!ward) {
      return NextResponse.json(
        { success: false, message: `Division ${wardNumber} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ward });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch ward';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ wardNumber: string }> }
) {
  try {
    const { wardNumber: rawWard } = await params;
    const wardNumber = parseInt(rawWard, 10);

    if (isNaN(wardNumber) || wardNumber < 1 || wardNumber > 76) {
      return NextResponse.json({ success: false, message: 'Invalid division number.' }, { status: 400 });
    }

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
          { success: false, message: 'Forbidden: Scanner staff cannot edit ward details or food counts.' },
          { status: 403 }
        );
      }

      adminUser = { id: user.id, name: profile.full_name || 'Admin' };
    } else {
      const role = request.cookies.get('brk_dev_role')?.value;
      if (role === 'scanner') {
        return NextResponse.json(
          { success: false, message: 'Forbidden: Scanner staff cannot edit ward details or food counts.' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const result = await updateWardAdmin(wardNumber, body, adminUser);

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, ward: result.ward, message: result.message });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update ward';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

