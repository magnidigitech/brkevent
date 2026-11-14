import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/server/dataStore';
import { DEFAULT_WHATSAPP_TEMPLATE } from '@/lib/utils/whatsapp';

export const dynamic = 'force-dynamic';

// In-memory fallback for settings
const inMemorySettings: Record<string, any> = {
  whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE,
};

export async function GET() {
  try {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value')
          .eq('key', 'whatsapp_template')
          .maybeSingle();

        if (data && data.value) {
          return NextResponse.json({
            success: true,
            settings: {
              whatsapp_template: typeof data.value === 'string' ? data.value : data.value.template,
            },
          });
        }
      } catch (dbErr) {
        // Fall back to memory if table does not exist
      }
    }

    return NextResponse.json({
      success: true,
      settings: {
        whatsapp_template: inMemorySettings.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch settings';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { whatsapp_template } = body;

    if (typeof whatsapp_template !== 'string') {
      return NextResponse.json({ success: false, message: 'Invalid template format' }, { status: 400 });
    }

    inMemorySettings.whatsapp_template = whatsapp_template;

    if (isSupabaseConfigured()) {
      try {
        const supabase = createAdminClient();
        // Upsert setting
        await supabase.from('app_settings').upsert({
          key: 'whatsapp_template',
          value: { template: whatsapp_template },
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('Could not persist setting to Supabase app_settings table:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: {
        whatsapp_template,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save settings';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

