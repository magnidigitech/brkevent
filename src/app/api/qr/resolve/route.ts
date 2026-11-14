import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Resolves dynamic redirect QR URLs (e.g. Canva QR codes like canvaqr.com/RGXWEjVF-I)
 * and extracts the destination ward number.
 */
export async function GET(request: NextRequest) {
  try {
    const targetUrl = request.nextUrl.searchParams.get('url');
    if (!targetUrl) {
      return NextResponse.json({ valid: false, message: 'URL parameter is required.' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return NextResponse.json({ valid: false, message: 'Invalid URL format.' }, { status: 400 });
    }

    const host = parsed.hostname.toLowerCase();
    // Allow Canva dynamic QR domains and our domain
    const isSupportedHost =
      host === 'canvaqr.com' ||
      host.endsWith('.canvaqr.com') ||
      host === 'event.bhashyamramakrishna.in' ||
      host === 'localhost';

    if (!isSupportedHost) {
      return NextResponse.json(
        { valid: false, message: `Unsupported dynamic QR domain: ${host}` },
        { status: 400 }
      );
    }

    // Direct check if URL itself already contains /ward[n]
    const directMatch = parsed.pathname.match(/\/ward([0-9]+)/i);
    if (directMatch) {
      const wardNo = parseInt(directMatch[1], 10);
      if (wardNo >= 1 && wardNo <= 76) {
        return NextResponse.json({
          valid: true,
          wardNumber: wardNo,
          resolvedUrl: `https://event.bhashyamramakrishna.in/ward${wardNo}`,
        });
      }
    }

    // Perform HTTP redirect lookup
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BRKEventBot/1.0)',
      },
    });

    const location = response.headers.get('location') || '';
    const match = location.match(/\/ward([0-9]+)/i);

    if (match) {
      const wardNumber = parseInt(match[1], 10);
      if (wardNumber >= 1 && wardNumber <= 76) {
        return NextResponse.json({
          valid: true,
          wardNumber,
          resolvedUrl: `https://event.bhashyamramakrishna.in/ward${wardNumber}`,
        });
      }
    }

    return NextResponse.json({
      valid: false,
      message: `Could not resolve destination ward from ${targetUrl} (redirected to: ${location || 'none'})`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error resolving QR code';
    return NextResponse.json({ valid: false, message }, { status: 500 });
  }
}

