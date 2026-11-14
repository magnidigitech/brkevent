import { NextResponse } from 'next/server';
import { getAllWards, calculateDashboardSummary } from '@/lib/server/dataStore';
import { ArrivalBatch } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Single consolidated fetch: loads all 76 wards once
    const wards = await getAllWards();
    const summary = calculateDashboardSummary(wards);

    // Extract recent batches directly from wards (no redundant queries)
    const allBatches: ArrivalBatch[] = [];
    wards.forEach((w) => {
      w.recent_batches.forEach((b) => {
        allBatches.push({
          ...b,
          ward_id: w.ward_number,
        });
      });
    });

    const recentBatches = allBatches.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({
      success: true,
      summary,
      wards,
      recent_batches: recentBatches.slice(0, 60),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
