import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://atkkyaepukxusocjtycm.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function uploadAllInvitationsToSupabase() {
  const invitationsDir = path.join(process.cwd(), 'public', 'invitations');
  const qrDir = path.join(invitationsDir, 'qr');

  console.log('Ensuring Supabase storage bucket "invitations" exists...');
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === 'invitations')) {
    await supabase.storage.createBucket('invitations', { public: true });
  }

  const files = fs.readdirSync(invitationsDir).filter((f) => f.endsWith('.jpg'));
  console.log(`Uploading ${files.length} invitations to Supabase storage in batches...`);

  let successCount = 0;
  const batchSize = 10;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (file) => {
        try {
          const filePath = path.join(invitationsDir, file);
          const fileBuffer = fs.readFileSync(filePath);

          const { error } = await supabase.storage.from('invitations').upload(file, fileBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

          if (error) {
            console.error(`Error uploading ${file}:`, error.message);
          } else {
            successCount++;
          }

          // Upload QR if exists
          const qrFile = file.replace('.jpg', '.png');
          const qrPath = path.join(qrDir, qrFile);
          if (fs.existsSync(qrPath)) {
            const qrBuffer = fs.readFileSync(qrPath);
            await supabase.storage.from('invitations').upload(`qr/${qrFile}`, qrBuffer, {
              contentType: 'image/png',
              upsert: true,
            });
          }
        } catch (e: any) {
          console.error(`Exception uploading ${file}:`, e?.message);
        }
      })
    );
  }

  console.log(`Successfully uploaded ${successCount}/${files.length} invitations online to Supabase!`);
  return successCount;
}

if (require.main === module) {
  uploadAllInvitationsToSupabase()
    .then((count) => {
      console.log('Upload finished:', count);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Upload failed:', err);
      process.exit(1);
    });
}
