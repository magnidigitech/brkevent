export interface QRParseResult {
  valid: boolean;
  wardNumber?: number;
  originalUrl: string;
  isDynamicRedirect?: boolean;
  error?: string;
}

const CANONICAL_HOST = 'event.bhashyamramakrishna.in';

/**
 * Validates and parses scanned QR content.
 * Accepts:
 * 1. Official printed URLs: event.bhashyamramakrishna.in/ward1 .. ward76
 * 2. Canva dynamic QR codes: canvaqr.com/...
 *
 * Rejects:
 * - Malformed URLs
 * - Unrelated foreign domains (e.g. evil.com)
 * - Wards < 1 or > 76
 */
export function parseWardQRCode(rawScannedText: string, currentHost?: string): QRParseResult {
  const trimmed = (rawScannedText || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      originalUrl: trimmed,
      error: 'Empty QR code scanned.',
    };
  }

  let parsedUrl: URL;
  try {
    if (trimmed.startsWith('/')) {
      parsedUrl = new URL(`https://${CANONICAL_HOST}${trimmed}`);
    } else {
      parsedUrl = new URL(trimmed);
    }
  } catch {
    return {
      valid: false,
      originalUrl: trimmed,
      error: 'Invalid URL format. Only official QR invitations are accepted.',
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // 1. Canva dynamic QR support (e.g. https://www.canvaqr.com/RGXWEjVF-I)
  if (hostname === 'canvaqr.com' || hostname.endsWith('.canvaqr.com')) {
    return {
      valid: true,
      originalUrl: trimmed,
      isDynamicRedirect: true,
    };
  }

  const allowedHosts = [
    CANONICAL_HOST,
    'localhost',
    '127.0.0.1',
  ];

  if (currentHost) {
    allowedHosts.push(currentHost.toLowerCase().split(':')[0]);
  }

  const isAllowedHost = allowedHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );

  if (!isAllowedHost) {
    return {
      valid: false,
      originalUrl: trimmed,
      error: `Unrecognized domain: "${hostname}". Only invitations on "${CANONICAL_HOST}" or official Canva invitation codes are valid.`,
    };
  }

  // Check path pattern: /ward1 to /ward76
  const pathname = parsedUrl.pathname.replace(/\/+$/, ''); // Remove trailing slash
  const wardMatch = pathname.match(/^\/ward([0-9]+)$/i);

  if (!wardMatch) {
    return {
      valid: false,
      originalUrl: trimmed,
      error: `Invalid invitation path "${pathname}". Expected /ward1 through /ward76.`,
    };
  }

  const wardNumber = parseInt(wardMatch[1], 10);
  if (isNaN(wardNumber) || wardNumber < 1 || wardNumber > 76) {
    return {
      valid: false,
      originalUrl: trimmed,
      error: `Ward number ${wardMatch[1]} is out of range. Valid wards are 1 to 76.`,
    };
  }

  return {
    valid: true,
    wardNumber,
    originalUrl: trimmed,
  };
}
