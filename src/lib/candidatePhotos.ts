import WINNING_CORPORATORS from '@/data/winningCorporators.json';

export interface WinningCorporator {
  ward: number;
  nameEn: string;
  party: 'TDP' | 'JSP' | 'BJP';
  nameTe: string;
  nameAnu: string;
}

// 64 Election Winners (TDP: 48, JSP: 13, BJP: 3)
export const WINNING_CORPORATORS_LIST = WINNING_CORPORATORS as WinningCorporator[];

export const WINNING_WARDS_SET = new Set<number>(
  WINNING_CORPORATORS_LIST.map((w) => w.ward)
);

// Map of wards that have a photo in public/invitations/Guntur_Ward_Images/
export const WARDS_WITH_PHOTOS = new Set<number>([
  1, 2, 3, 4, 5, 7, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
  28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 50, 51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 68, 69, 70, 71,
  72, 75, 76
]);

const SUPABASE_CDN_CANDIDATES = 'https://atkkyaepukxusocjtycm.supabase.co/storage/v1/object/public/invitations/candidates';

export function isWinningWard(wardNumber: number): boolean {
  return WINNING_WARDS_SET.has(wardNumber);
}

export function getWinningCorporator(wardNumber: number): WinningCorporator | undefined {
  return WINNING_CORPORATORS_LIST.find((w) => w.ward === wardNumber);
}

export function getCandidatePhotoFileName(wardNumber: number): string {
  return `Ward_${wardNumber.toString().padStart(2, '0')}.webp`;
}

export function getCandidatePhotoUrls(wardNumber: number): {
  localUrl: string;
  onlineUrl: string;
  hasPhoto: boolean;
} {
  const fileName = getCandidatePhotoFileName(wardNumber);
  const hasPhoto = WARDS_WITH_PHOTOS.has(wardNumber);

  return {
    localUrl: `/invitations/Guntur_Ward_Images/${fileName}`,
    onlineUrl: `${SUPABASE_CDN_CANDIDATES}/${fileName}`,
    hasPhoto,
  };
}

export function getCandidateJpegPhotoUrls(wardNumber: number): {
  localUrl: string;
  onlineUrl: string;
  hasPhoto: boolean;
} {
  const fileName = `Ward_${wardNumber.toString().padStart(2, '0')}.jpg`;
  const hasPhoto = WARDS_WITH_PHOTOS.has(wardNumber);

  return {
    localUrl: `/invitations/Guntur_Ward_Images/${fileName}`,
    onlineUrl: `${SUPABASE_CDN_CANDIDATES}/${fileName}`,
    hasPhoto,
  };
}

const LOCAL_STORAGE_KEY_PREFIX = 'brk_candidate_photo_';

/**
 * Synchronous offline getter from browser localStorage
 * Returns base64 Data URL if pre-cached, or null
 */
export function getCachedCandidatePhotoFromLocalStorage(wardNumber: number): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${wardNumber}`);
  } catch {
    return null;
  }
}

/**
 * Pre-caches all candidate images into localStorage as base64 Data URLs on app opening.
 * Ensures instant 0ms offline display even on low/no network.
 */
export async function cacheCandidatePhotosInLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // Only pre-cache the winning wards with photos
    const winningWithPhotos = WINNING_CORPORATORS_LIST.filter((w) =>
      WARDS_WITH_PHOTOS.has(w.ward)
    );

    // Process in batches of 6 to avoid blocking the main thread
    for (let i = 0; i < winningWithPhotos.length; i += 6) {
      const batch = winningWithPhotos.slice(i, i + 6);
      await Promise.all(
        batch.map(async (corp) => {
          const key = `${LOCAL_STORAGE_KEY_PREFIX}${corp.ward}`;
          if (localStorage.getItem(key)) {
            return; // already cached
          }

          const { localUrl, onlineUrl } = getCandidatePhotoUrls(corp.ward);

          try {
            // First try local asset, fallback to online CDN
            let res = await fetch(localUrl);
            if (!res.ok) {
              res = await fetch(onlineUrl);
            }

            if (res.ok) {
              const blob = await res.blob();
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });

              localStorage.setItem(key, base64);
            }
          } catch {
            // Silent catch during background pre-cache
          }
        })
      );
    }
  } catch (err) {
    console.warn('Could not complete candidate photo offline caching:', err);
  }
}
