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

  // If Supabase keys are not configured yet, use secure development cookie session check
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    const roleCookie = request.cookies.get('brk_dev_role')?.value;

    if (!roleCookie && isProtectedPath) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }

    if (roleCookie && pathname === '/login') {
      const returnUrl = request.nextUrl.searchParams.get('returnUrl') || '/scanner';
      const url = request.nextUrl.clone();
      url.pathname = returnUrl;
      url.searchParams.delete('returnUrl');
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const devRoleCookie = request.cookies.get('brk_dev_role')?.value;
  const isAuthenticated = !!(user || devRoleCookie);

  // If user is not authenticated and trying to access protected paths
  if (!isAuthenticated && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(url);
  }

  // If user is logged in and visits /login, redirect to returnUrl or scanner
  if (isAuthenticated && pathname === '/login') {
    const returnUrl = request.nextUrl.searchParams.get('returnUrl') || '/scanner';
    const url = request.nextUrl.clone();
    url.pathname = returnUrl;
    url.searchParams.delete('returnUrl');
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
