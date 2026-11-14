import { NextResponse } from 'next/server';
import { getAllBatches, getAllWards } from '@/lib/server/dataStore';
import { generateCsv } from '@/lib/csv/export';
import { formatInKolkataTime } from '@/lib/utils/date';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const batches = await getAllBatches();
    const wards = await getAllWards();
    const wardMap = new Map(wards.map((w) => [w.ward_number, w]));

    const headers = [
      'Batch ID',
      'Ward Number',
      'Principal Invitee',
      'Batch Size',
      'Date/Time (Asia/Kolkata)',
      'Timestamp (UTC)',
      'Staff Name',
      'Staff Email',
      'Excess Acknowledged',
      'Excess Count',
      'Status',
      'Void Reason',
      'Voided At (Asia/Kolkata)',
      'Request ID',
    ];

    const rows = batches.map((b) => {
      const ward = wardMap.get(b.ward_id);
      return [
        b.id,
        b.ward_id,
        ward?.candidate_name || 'Ward ' + b.ward_id,
        b.batch_size,
        formatInKolkataTime(b.created_at),
        b.created_at,
        b.recorded_by_name || 'Staff',
        b.recorded_by_email || '',
        b.excess_acknowledged ? 'Yes' : 'No',
        b.excess_count,
        b.is_voided ? 'Voided' : 'Valid',
        b.void_reason || '',
        b.voided_at ? formatInKolkataTime(b.voided_at) : '',
        b.request_id,
      ];
    });

    const csv = generateCsv(headers, rows);
    const filename = `brk-event-entry-history-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse('\uFEFF' + csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export entries';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
