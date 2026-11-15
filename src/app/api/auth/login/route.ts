import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    let normalizedEmail = (email || '').trim().toLowerCase();
    // Allow entering just 'admin', 'scanner1', 'vivek' without typing full domain on mobile
    if (normalizedEmail && !normalizedEmail.includes('@')) {
      normalizedEmail = `${normalizedEmail}@bhashyamramakrishna.in`;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const isMasterPassword =
      password === 'Magni@3939' ||
      password === 'SecureAdmin2026!' ||
      password === 'Bhashyam@3939';

    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      const supabase = await createClient();
      let { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      // If login failed, auto-sync or auto-provision account if using valid staff credentials
      if (error && isMasterPassword && serviceKey && !serviceKey.includes('placeholder')) {
        try {
          const adminClient = createAdminClient();
          const { data: userList } = await adminClient.auth.admin.listUsers();
          const existingUser = userList?.users?.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );

          const role = normalizedEmail.includes('scanner') ? 'scanner' : 'admin';
          const fullName = normalizedEmail.includes('vivek')
            ? 'Venkata Vivek'
            : normalizedEmail.includes('scanner')
            ? 'Gate Scanner'
            : 'Admin Staff';

          if (existingUser) {
            await adminClient.auth.admin.updateUserById(existingUser.id, {
              password,
              email_confirm: true,
            });

            await adminClient.from('profiles').upsert({
              id: existingUser.id,
              email: normalizedEmail,
              full_name: fullName,
              role,
            });

            const retry = await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            });

            if (retry.data?.user) {
              data = retry.data;
              error = null;
            }
          } else {
            const { data: created, error: createErr } =
              await adminClient.auth.admin.createUser({
                email: normalizedEmail,
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName },
              });

            if (!createErr && created?.user) {
              await adminClient.from('profiles').upsert({
                id: created.user.id,
                email: normalizedEmail,
                full_name: fullName,
                role,
              });

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
          console.warn('Auto-sync error:', provErr);
        }
      }

      if (error && !data?.user) {
        // Fallback: if user provided correct staff master password, allow session directly
        if (isMasterPassword) {
          const role = normalizedEmail.includes('scanner') ? 'scanner' : 'admin';
          const response = NextResponse.json({
            success: true,
            message: 'Logged in successfully',
            user: { email: normalizedEmail, role },
          });
          response.cookies.set('brk_dev_role', role, {
            path: '/',
            httpOnly: false,
            maxAge: 60 * 60 * 24 * 7,
            sameSite: 'lax',
          });
          return response;
        }

        return NextResponse.json(
          { success: false, message: 'Invalid email address or password. Please try again.' },
          { status: 401 }
        );
      }

      const role = normalizedEmail.includes('scanner') ? 'scanner' : 'admin';
      const response = NextResponse.json({ success: true, user: data?.user });
      response.cookies.set('brk_dev_role', role, {
        path: '/',
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
      });
      return response;
    }

    // Local development fallback
    const isValidDevUser = isMasterPassword || normalizedEmail.includes('vivek') || normalizedEmail.includes('admin');
    if (!isValidDevUser) {
      return NextResponse.json(
        { success: false, message: 'Invalid email address or password.' },
        { status: 401 }
      );
    }

    const role = normalizedEmail.includes('scanner') ? 'scanner' : 'admin';
    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: {
        email: normalizedEmail,
        role,
        full_name: role === 'admin' ? 'Venkata Vivek' : 'Gate Scanner',
      },
    });

    response.cookies.set('brk_dev_role', role, {
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error occurred during login';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
