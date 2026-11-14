import { NextResponse } from 'next/server';
import { getAllWards } from '@/lib/server/dataStore';
import { generateCsv } from '@/lib/csv/export';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const wards = await getAllWards();

    const headers = [
      'Ward Number',
      'Principal Invitee Name',
      'Party',
      'Allowance',
      'Total Entered',
      'Remaining Allowance',
      'Excess Count',
      'Expected Vegetarian',
      'Expected Non-Vegetarian',
      'Food Status',
      'Phone Number',
      'Accompanying Guests',
      'Admin Notes',
    ];

    const rows = wards.map((w) => [
      w.ward_number,
      w.candidate_name,
      w.party,
      w.allowance,
      w.total_entered,
      w.remaining_allowance,
      w.excess_count,
      w.expected_veg !== null ? w.expected_veg : 'Unset',
      w.expected_non_veg !== null ? w.expected_non_veg : 'Unset',
      w.food_confirmed ? 'Confirmed' : 'Unconfirmed',
      w.phone || '',
      w.guests.map((g) => g.guest_name).join('; '),
      w.admin_notes || '',
    ]);

    const csv = generateCsv(headers, rows);
    const filename = `brk-event-ward-summary-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse('\uFEFF' + csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export CSV';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

