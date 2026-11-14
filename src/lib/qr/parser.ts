export interface QRParseResult {
  valid: boolean;
  wardNumber?: number;
  originalUrl: string;
  error?: string;
}

const CANONICAL_HOST = 'event.bhashyamramakrishna.in';

/**
 * Validates and parses scanned QR content.
 * Accepts only official QR invitation URLs for event.bhashyamramakrishna.in
 * with path /ward1 through /ward76.
 *
 * Rejects:
 * - Malformed URLs
 * - Unrelated domains (e.g. evil.com/ward1)
 * - Non-ward paths
 * - Ward numbers < 1 or > 76
 */
export function parseWardQRCode(rawScannedText: string, currentHost?: string): QRParseResult {
  const trimmed = (rawScannedText || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      originalUrl: trimmed,
      error: 'Empty QR code scanned.'
    };
  }

  let parsedUrl: URL;
  try {
    // If input is a relative path like "/ward12"
    if (trimmed.startsWith('/')) {
      parsedUrl = new URL(`https://${CANONICAL_HOST}${trimmed}`);
    } else {
      parsedUrl = new URL(trimmed);
    }
  } catch {
    return {
      valid: false,
      originalUrl: trimmed,
      error: 'Invalid URL format. Only official QR invitations are accepted.'
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const allowedHosts = [
    CANONICAL_HOST,
    'localhost',
    '127.0.0.1'
  ];

  if (currentHost) {
    allowedHosts.push(currentHost.toLowerCase().split(':')[0]);
  }

  const isAllowedHost = allowedHosts.some(host => hostname === host || hostname.endsWith(`.${host}`));

  if (!isAllowedHost) {
    return {
      valid: false,
      originalUrl: trimmed,
      error: `Unrecognized domain: "${hostname}". Only invitations on "${CANONICAL_HOST}" are valid.`
    };
  }

  // Check path pattern: /ward1 to /ward76
  const pathname = parsedUrl.pathname.replace(/\/+$/, ''); // Remove trailing slash
  const wardMatch = pathname.match(/^\/ward([0-9]+)$/i);

  if (!wardMatch) {
    return {
      valid: false,
      originalUrl: trimmed,
      error: `Invalid invitation path "${pathname}". Expected /ward1 through /ward76.`
    };
  }

  const wardNumber = parseInt(wardMatch[1], 10);
  if (isNaN(wardNumber) || wardNumber < 1 || wardNumber > 76) {
    return {
      valid: false,
      originalUrl: trimmed,
      error: `Ward number ${wardMatch[1]} is out of range. Valid wards are 1 to 76.`
    };
  }

  return {
    valid: true,
    wardNumber,
    originalUrl: trimmed
  };
}

