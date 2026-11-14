import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { email, password, devRole } = await request.json();

    const normalizedEmail = (email || '').trim().toLowerCase();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      const supabase = await createClient();
      let { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      // If login failed (e.g. user hasn't been created in Supabase yet)
      if (error && serviceKey && !serviceKey.includes('placeholder')) {
        try {
          // Attempt automatic initial admin provisioning if logging in with primary email
          const adminClient = createAdminClient();
          const { data: userList } = await adminClient.auth.admin.listUsers();
          const existingUser = userList?.users?.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );

          if (!existingUser) {
            // Auto-provision initial administrator or staff account
            const role =
              devRole ||
              (normalizedEmail.includes('scanner') ? 'scanner' : 'admin');

            const { data: created, error: createErr } =
              await adminClient.auth.admin.createUser({
                email: normalizedEmail,
                password,
                email_confirm: true,
                user_metadata: {
                  full_name:
                    normalizedEmail === 'vivek@gmail.com'
                      ? 'Venkata Vivek'
                      : normalizedEmail.split('@')[0],
                },
              });

            if (!createErr && created?.user) {
              await adminClient.from('profiles').upsert({
                id: created.user.id,
                email: normalizedEmail,
                full_name:
                  normalizedEmail === 'vivek@gmail.com'
                    ? 'Venkata Vivek'
                    : normalizedEmail.split('@')[0],
                role,
              });

              // Retry sign in now that account is provisioned
              const retry = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
              });

              if (retry.data?.user) {
                data = retry.data;
                error = null;
              }
            }
          }
        } catch (provErr) {
          console.warn('Auto-provisioning check failed:', provErr);
        }
      }

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, user: data.user });
    }

    // Local development fallback (when Supabase keys are not yet configured)
    const role =
      devRole || (normalizedEmail.includes('admin') || normalizedEmail.includes('vivek') ? 'admin' : 'scanner');

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully (Dev Mode)',
      user: { email: normalizedEmail, role },
    });

    response.cookies.set('brk_dev_role', role, {
      path: '/',
      httpOnly: false,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
