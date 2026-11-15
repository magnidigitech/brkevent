import WINNING_CORPORATORS from '@/data/winningCorporators.json';

const CACHE_NAME = 'brk-invitations-v2';
const SUPABASE_CDN_BASE = 'https://atkkyaepukxusocjtycm.supabase.co/storage/v1/object/public/invitations';

/**
 * Pre-cache all 64 final high-resolution invitation JPEG images (approx 45MB total)
 * in browser CacheStorage on mobile so they load instantly offline (0ms) and can be shared
 * directly as raw image files even with no network connection.
 */
export async function cacheAllInvitationsLocally(): Promise<{ cached: number; total: number }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { cached: 0, total: WINNING_CORPORATORS.length };
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    let cachedCount = 0;

    // Cache in small batches so we don't saturate mobile network/CPU
    const batchSize = 6;
    for (let i = 0; i < WINNING_CORPORATORS.length; i += batchSize) {
      const batch = WINNING_CORPORATORS.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (c) => {
          const url = `/invitations/${c.ward}.jpg`;
          try {
            const match = await cache.match(url);
            if (!match) {
              const res = await fetch(url);
              if (res.ok) {
                await cache.put(url, res.clone());
                cachedCount++;
              }
            } else {
              cachedCount++;
            }
          } catch {
            // Ignore individual fetch errors (will retry on demand)
          }
        })
      );
    }

    return { cached: cachedCount, total: WINNING_CORPORATORS.length };
  } catch (err) {
    console.warn('CacheStorage pre-caching error:', err);
    return { cached: 0, total: WINNING_CORPORATORS.length };
  }
}

/**
 * Retrieve the high-resolution invitation image file for a given ward.
 * Serves from local CacheStorage in 0ms if cached, or fetches and caches.
 */
export async function getInvitationFileForSharing(wardNumber: number): Promise<File | null> {
  if (typeof window === 'undefined') return null;

  const localUrl = `/invitations/${wardNumber}.jpg`;
  const fallbackUrl = `${SUPABASE_CDN_BASE}/${wardNumber}.jpg`;
  const fileName = `Invitation_Division_${wardNumber}.jpg`;

  let blob: Blob | null = null;

  // 1. Try CacheStorage
  if ('caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(localUrl);
      if (match) {
        blob = await match.blob();
      }
    } catch {}
  }

  // 2. Fallback fetch
  if (!blob) {
    try {
      let res = await fetch(localUrl);
      if (!res.ok) {
        res = await fetch(fallbackUrl);
      }
      if (res.ok) {
        blob = await res.blob();
        // Put into cache for next time
        if ('caches' in window) {
          try {
            const cache = await caches.open(CACHE_NAME);
            const clone = new Response(blob.slice(), {
              headers: { 'Content-Type': 'image/jpeg' },
            });
            await cache.put(localUrl, clone);
          } catch {}
        }
      }
    } catch (err) {
      console.error('Failed to load invitation image for sharing:', err);
    }
  }

  if (!blob) return null;

  return new File([blob], fileName, { type: 'image/jpeg' });
}
