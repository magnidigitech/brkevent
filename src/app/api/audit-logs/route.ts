import { NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/server/dataStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const logs = await getAuditLogs();
    return NextResponse.json({ success: true, count: logs.length, logs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch audit logs';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
