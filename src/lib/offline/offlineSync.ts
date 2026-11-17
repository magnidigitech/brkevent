import { WardWithStats, ArrivalBatch, RecordArrivalPayload, RecordArrivalResponse } from '@/types/database';
import { WARDS_SEED_DATA } from '@/data/wardsSeed';

const CACHE_KEY_WARDS = 'brk_wards_offline_cache_v2';
const CACHE_KEY_QUEUE = 'brk_arrivals_pending_queue_v2';
const CACHE_KEY_CANVA = 'brk_canva_qr_cache_v2';

export interface PendingArrivalItem {
  id: string;
  payload: RecordArrivalPayload;
  timestamp: string;
  attempts: number;
}

// In-Memory cache for 0ms synchronous retrieval
let memoryWardsMap: Map<number, WardWithStats> = new Map();
let isInitialized = false;

/**
 * Generate default fallback ward for any division 1..76
 */
export function createDefaultWardStats(wardNumber: number): WardWithStats {
  const seed = WARDS_SEED_DATA.find((s) => s.ward_number === wardNumber);
  return {
    id: wardNumber,
    ward_number: wardNumber,
    candidate_name: seed?.candidate_name || `Division ${wardNumber}`,
    party: seed?.party || 'TDP',
    allowance: 5,
    phone: seed?.phone || null,
    expected_veg: null,
    expected_non_veg: null,
    food_confirmed: false,
    admin_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    total_entered: 0,
    remaining_allowance: 5,
    excess_count: 0,
    guests: [],
    recent_batches: [],
  };
}

/**
 * Initialize offline storage from localStorage or seed
 * Synchronous and instant (0ms latency)
 */
export function initOfflineStorage(): Map<number, WardWithStats> {
  if (typeof window === 'undefined') {
    // SSR fallback: populate with seed
    if (memoryWardsMap.size === 0) {
      WARDS_SEED_DATA.forEach((s) => {
        memoryWardsMap.set(s.ward_number, createDefaultWardStats(s.ward_number));
      });
    }
    return memoryWardsMap;
  }

  if (isInitialized && memoryWardsMap.size >= 76) {
    return memoryWardsMap;
  }

  try {
    const raw = localStorage.getItem(CACHE_KEY_WARDS);
    if (raw) {
      const parsed: WardWithStats[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryWardsMap.clear();
        parsed.forEach((w) => memoryWardsMap.set(w.ward_number, w));
      }
    }
  } catch (err) {
    console.warn('Failed to parse offline wards cache:', err);
  }

  // Ensure all 76 wards exist in cache
  for (let i = 1; i <= 76; i++) {
    if (!memoryWardsMap.has(i)) {
      memoryWardsMap.set(i, createDefaultWardStats(i));
    }
  }

  isInitialized = true;
  saveWardsToLocalStorage();
  return memoryWardsMap;
}

/**
 * Persist memory wards map to localStorage
 */
function saveWardsToLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    const list = Array.from(memoryWardsMap.values());
    localStorage.setItem(CACHE_KEY_WARDS, JSON.stringify(list));
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
  }
}

/**
 * Get cached division details synchronously in 0ms
 */
export function getCachedWard(wardNumber: number): WardWithStats {
  if (memoryWardsMap.size === 0) {
    initOfflineStorage();
  }
  const cached = memoryWardsMap.get(wardNumber);
  if (cached) return cached;
  const fallback = createDefaultWardStats(wardNumber);
  memoryWardsMap.set(wardNumber, fallback);
  return fallback;
}

/**
 * Save freshly fetched live wards to offline cache
 */
export function updateCachedWards(wards: WardWithStats[]) {
  if (!Array.isArray(wards) || wards.length === 0) return;
  wards.forEach((w) => {
    memoryWardsMap.set(w.ward_number, w);
  });
  saveWardsToLocalStorage();
}

/**
 * Get all pending sync queue items
 */
export function getPendingQueue(): PendingArrivalItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save pending sync queue items to localStorage
 */
function savePendingQueue(queue: PendingArrivalItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY_QUEUE, JSON.stringify(queue));
  } catch (err) {
    console.warn('Failed to save sync queue:', err);
  }
}

/**
 * Optimistic local recording:
 * 1. Updates local attendance immediately in 0ms
 * 2. Adds to background sync queue
 */
export function recordArrivalOptimistic(
  payload: RecordArrivalPayload,
  staffName: string = 'Staff',
  targetWardNumber?: number
): { ward: WardWithStats; response: RecordArrivalResponse } {
  let resolvedWardNum = targetWardNumber;
  if (!resolvedWardNum) {
    if (typeof payload.ward_id === 'number' && memoryWardsMap.has(payload.ward_id)) {
      resolvedWardNum = payload.ward_id;
    } else {
      const match = Array.from(memoryWardsMap.values()).find(
        (w) => String(w.id) === String(payload.ward_id)
      );
      resolvedWardNum = match ? match.ward_number : (typeof payload.ward_id === 'number' ? payload.ward_id : 1);
    }
  }

  const currentWard = getCachedWard(resolvedWardNum);

  const priorEntered = currentWard.total_entered;
  const newEntered = priorEntered + payload.batch_size;
  const newRemaining = Math.max(0, currentWard.allowance - newEntered);
  const newExcess = Math.max(0, newEntered - currentWard.allowance);

  const newBatch: ArrivalBatch = {
    id: `local-${payload.request_id.substring(0, 8)}`,
    ward_id: currentWard.id,
    batch_size: payload.batch_size,
    request_id: payload.request_id,
    is_voided: false,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    excess_acknowledged: payload.acknowledge_excess || false,
    excess_count: newExcess,
    excess_acknowledged_by: payload.acknowledge_excess ? staffName : null,
    excess_acknowledged_at: payload.acknowledge_excess ? new Date().toISOString() : null,
    recorded_by: 'current-user',
    recorded_by_name: staffName,
    recorded_by_email: '',
    created_at: new Date().toISOString(),
  };

  const updatedWard: WardWithStats = {
    ...currentWard,
    total_entered: newEntered,
    remaining_allowance: newRemaining,
    excess_count: newExcess,
    recent_batches: [newBatch, ...(currentWard.recent_batches || [])],
  };

  // Update memory & localStorage immediately
  memoryWardsMap.set(updatedWard.ward_number, updatedWard);
  saveWardsToLocalStorage();

  // Add to pending sync queue
  const queue = getPendingQueue();
  // Check if already in queue by request_id
  if (!queue.some((item) => item.payload.request_id === payload.request_id)) {
    queue.push({
      id: payload.request_id,
      payload,
      timestamp: new Date().toISOString(),
      attempts: 0,
    });
    savePendingQueue(queue);
  }

  const response: RecordArrivalResponse = {
    success: true,
    message: `Entry recorded locally! Cumulative: ${newEntered} people.`,
    batch_id: newBatch.id,
    ward_id: currentWard.id,
    batch_size: payload.batch_size,
    prior_entered: priorEntered,
    cumulative_entered: newEntered,
    allowance: currentWard.allowance,
    excess_by: newExcess,
  };

  return { ward: updatedWard, response };
}

/**
 * Background Sync Processor:
 * Flushes all queued arrival batches to server
 */
let isSyncing = false;

export async function flushPendingQueue(): Promise<{
  synced: number;
  remaining: number;
  errors: number;
}> {
  if (typeof window === 'undefined' || isSyncing) {
    return { synced: 0, remaining: getPendingQueue().length, errors: 0 };
  }

  const queue = getPendingQueue();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0, errors: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let errors = 0;
  const remainingQueue: PendingArrivalItem[] = [];

  for (const item of queue) {
    try {
      const res = await fetch('/api/arrivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        synced++;
      } else if (data.message && data.message.includes('Duplicate request')) {
        // Already recorded by server (idempotency), safe to remove from queue
        synced++;
      } else {
        item.attempts += 1;
        remainingQueue.push(item);
        errors++;
      }
    } catch (err) {
      // Network still down or unreachable, keep in queue
      item.attempts += 1;
      remainingQueue.push(item);
      errors++;
    }
  }

  savePendingQueue(remainingQueue);
  isSyncing = false;

  // After syncing, fetch latest server state in background
  if (synced > 0) {
    try {
      const res = await fetch('/api/wards');
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data?.wards)) {
          updateCachedWards(data.wards);
        }
      }
    } catch {}
  }

  return { synced, remaining: remainingQueue.length, errors };
}

/**
 * Canva QR Code Local Cache
 */
export function cacheCanvaResolution(canvaUrl: string, wardNumber: number) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(CACHE_KEY_CANVA);
    const map = raw ? JSON.parse(raw) : {};
    map[canvaUrl] = wardNumber;
    localStorage.setItem(CACHE_KEY_CANVA, JSON.stringify(map));
  } catch {}
}

export function getCachedCanvaResolution(canvaUrl: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY_CANVA);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[canvaUrl] || null;
  } catch {
    return null;
  }
}
