import { NextResponse } from 'next/server';
import { getAllWards } from '@/lib/server/dataStore';

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

