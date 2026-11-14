import { NextResponse } from 'next/server';
import { getDashboardSummary, getAllBatches } from '@/lib/server/dataStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await getDashboardSummary();
    const batches = await getAllBatches();

    return NextResponse.json({
      success: true,
      summary,
      recent_batches: batches.slice(0, 50),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
