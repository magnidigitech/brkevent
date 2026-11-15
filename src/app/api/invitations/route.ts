import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import WINNING_CORPORATORS from '@/data/winningCorporators.json';
import { uploadAllInvitationsToSupabase } from '@/../scripts/upload_to_supabase';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

const SUPABASE_STORAGE_URL = 'https://atkkyaepukxusocjtycm.supabase.co/storage/v1/object/public/invitations';

export async function GET() {
  try {
    const corporators = WINNING_CORPORATORS.map((c) => ({
      ...c,
      localImageUrl: `/invitations/${c.ward}.jpg`,
      publicImageUrl: `${SUPABASE_STORAGE_URL}/${c.ward}.jpg`,
      publicQrUrl: `${SUPABASE_STORAGE_URL}/qr/${c.ward}.png`,
      passUrl: `https://event.bhashyamramakrishna.in/ward${c.ward}`,
    }));

    return NextResponse.json({
      success: true,
      total: corporators.length,
      corporators,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch invitations';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const action = formData.get('action') as string;

      if (action === 'update_template') {
        const file = formData.get('file') as File | null;
        if (!file) {
          return NextResponse.json({ success: false, message: 'No template file provided' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = path.extname(file.name) || '.png';
        const tempPath = path.join(process.cwd(), 'scripts', 'assets', `uploaded_template${ext}`);

        fs.writeFileSync(tempPath, buffer);

        // 1. Process uploaded template
        console.log('Updating base template from:', tempPath);
        await execAsync(`python3 scripts/update_template.py "${tempPath}"`);

        // 2. Regenerate all 65 invitations
        console.log('Regenerating all 65 invitations...');
        await execAsync('python3 scripts/generate_all_invitations.py');

        // 3. Upload to Supabase Storage
        console.log('Syncing all invitations to Supabase...');
        const uploadedCount = await uploadAllInvitationsToSupabase();

        return NextResponse.json({
          success: true,
          count: uploadedCount,
          message: `Base template updated! All ${uploadedCount} invitations regenerated and synced to cloud storage.`,
        });
      }
    }

    // Default JSON actions
    let action = 'regenerate';
    try {
      const body = await req.json();
      if (body.action) action = body.action;
    } catch {
      // no body, defaults to regenerate
    }

    if (action === 'regenerate') {
      console.log('Regenerating all 65 invitations...');
      await execAsync('python3 scripts/generate_all_invitations.py');

      console.log('Syncing all invitations to Supabase...');
      const uploadedCount = await uploadAllInvitationsToSupabase();

      return NextResponse.json({
        success: true,
        count: uploadedCount,
        message: `Successfully regenerated all ${uploadedCount} invitations and synced to cloud storage!`,
      });
    }

    return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Error in invitations API:', err);
    const message = err instanceof Error ? err.message : 'Failed to process invitation request';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
