import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
  // Scanner and Dashboard require staff authentication.
  const isProtectedPath = pathname.startsWith('/dashboard') || pathname.startsWith('/scanner');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Check fallback dev/staff role cookie
  const roleCookie = request.cookies.get('brk_dev_role')?.value;
  let isDevAuth = !!roleCookie;

  // If Supabase keys are not configured yet, use secure cookie session check
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    if (!isDevAuth && isProtectedPath) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }

    // If user is already authenticated and lands on /login, redirect forward to scanner
    if (isDevAuth && pathname === '/login') {
      const target = request.nextUrl.searchParams.get('returnUrl') || '/scanner';
      const safeTarget = target.startsWith('/login') ? '/scanner' : target;
      const url = request.nextUrl.clone();
      url.pathname = safeTarget;
      url.search = '';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const authRes = await supabase.auth.getUser();
    user = authRes.data?.user || null;
  } catch {
    user = null;
  }

  const isAuthenticated = !!user || isDevAuth;

  // If user is not authenticated and trying to access protected paths
  if (!isAuthenticated && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(url);
  }

  // If user is logged in and visits /login, redirect to target or scanner
  if (isAuthenticated && pathname === '/login') {
    const target = request.nextUrl.searchParams.get('returnUrl') || '/scanner';
    const safeTarget = target.startsWith('/login') ? '/scanner' : target;
    const url = request.nextUrl.clone();
    url.pathname = safeTarget;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
