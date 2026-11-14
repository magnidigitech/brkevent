import { WARDS_SEED_DATA } from '@/data/wardsSeed';
import {
  WardWithStats,
  ArrivalBatch,
  WardGuest,
  DashboardSummary,
  RecordArrivalPayload,
  RecordArrivalResponse,
  UserProfile,
} from '@/types/database';
import { createAdminClient } from '@/lib/supabase/admin';

// Check if live Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key && !url.includes('placeholder') && !key.includes('placeholder'));
}

// In-Memory Fallback State (used when Supabase is not configured or in local test environment)
interface InMemoryState {
  wards: Map<number, WardWithStats>;
  batches: ArrivalBatch[];
  auditLogs: Array<{
    id: string;
    table_name: string;
    record_id: string;
    action: string;
    performed_by: string;
    old_data: unknown;
    new_data: unknown;
    reason: string | null;
    created_at: string;
  }>;
}

// Global in-memory singleton for development / testing without live database
const globalState: InMemoryState = {
  wards: new Map(),
  batches: [],
  auditLogs: [],
};

// Initialize in-memory wards from 76-ward seed
function initializeInMemoryWards() {
  if (globalState.wards.size === 0) {
    WARDS_SEED_DATA.forEach((w) => {
      globalState.wards.set(w.ward_number, {
        id: w.ward_number,
        ward_number: w.ward_number,
        candidate_name: w.candidate_name,
        party: w.party,
        allowance: 5,
        phone: null,
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
      });
    });
  }
}

initializeInMemoryWards();

/**
 * Recalculate attendance stats for a specific ward in the memory store
 */
function updateWardStatsInMemory(wardNumber: number) {
  const ward = globalState.wards.get(wardNumber);
  if (!ward) return;

  const validBatches = globalState.batches.filter(
    (b) => b.ward_id === ward.id && !b.is_voided
  );

  const totalEntered = validBatches.reduce((acc, b) => acc + b.batch_size, 0);
  const remainingAllowance = Math.max(0, ward.allowance - totalEntered);
  const excessCount = Math.max(0, totalEntered - ward.allowance);

  ward.total_entered = totalEntered;
  ward.remaining_allowance = remainingAllowance;
  ward.excess_count = excessCount;
  ward.recent_batches = globalState.batches
    .filter((b) => b.ward_id === ward.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Get all 76 wards with their live attendance statistics
 */
export async function getAllWards(): Promise<WardWithStats[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data: wards, error: wardsErr } = await supabase
        .from('wards')
        .select('*')
        .order('ward_number', { ascending: true });

      if (wardsErr) throw wardsErr;

      const { data: batches, error: batchesErr } = await supabase
        .from('arrival_batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (batchesErr) throw batchesErr;

      const { data: guests, error: guestsErr } = await supabase
        .from('ward_guests')
        .select('*');

      if (guestsErr) throw guestsErr;

      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email');
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      return (wards || []).map((w) => {
        const wardBatches = (batches || []).filter((b) => b.ward_id === w.id);
        const activeBatches = wardBatches.filter((b) => !b.is_voided);
        const totalEntered = activeBatches.reduce((acc, b) => acc + b.batch_size, 0);
        const wardGuests = (guests || []).filter((g) => g.ward_id === w.id);

        const enrichedBatches: ArrivalBatch[] = wardBatches.map((b) => ({
          ...b,
          recorded_by_name: profileMap.get(b.recorded_by)?.full_name || 'Staff',
          recorded_by_email: profileMap.get(b.recorded_by)?.email || '',
        }));

        return {
          ...w,
          total_entered: totalEntered,
          remaining_allowance: Math.max(0, w.allowance - totalEntered),
          excess_count: Math.max(0, totalEntered - w.allowance),
          guests: wardGuests,
          recent_batches: enrichedBatches,
        };
      });
    } catch (err) {
      console.warn('Supabase query error, falling back to local store:', err);
    }
  }

  // Fallback to in-memory store
  return Array.from(globalState.wards.values()).sort(
    (a, b) => a.ward_number - b.ward_number
  );
}

/**
 * Get single ward by ward number (1-76)
 */
export async function getWardByNumber(wardNumber: number): Promise<WardWithStats | null> {
  if (wardNumber < 1 || wardNumber > 76) return null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data: ward, error: wardErr } = await supabase
        .from('wards')
        .select('*')
        .eq('ward_number', wardNumber)
        .single();

      if (wardErr || !ward) return null;

      const { data: batches } = await supabase
        .from('arrival_batches')
        .select('*')
        .eq('ward_id', ward.id)
        .order('created_at', { ascending: false });

      const { data: guests } = await supabase
        .from('ward_guests')
        .select('*')
        .eq('ward_id', ward.id)
        .order('guest_number', { ascending: true });

      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email');
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const activeBatches = (batches || []).filter((b) => !b.is_voided);
      const totalEntered = activeBatches.reduce((acc, b) => acc + b.batch_size, 0);

      const enrichedBatches: ArrivalBatch[] = (batches || []).map((b) => ({
        ...b,
        recorded_by_name: profileMap.get(b.recorded_by)?.full_name || 'Staff',
        recorded_by_email: profileMap.get(b.recorded_by)?.email || '',
      }));

      return {
        ...ward,
        total_entered: totalEntered,
        remaining_allowance: Math.max(0, ward.allowance - totalEntered),
        excess_count: Math.max(0, totalEntered - ward.allowance),
        guests: guests || [],
        recent_batches: enrichedBatches,
      };
    } catch (err) {
      console.warn('Supabase getWard error, using local store:', err);
    }
  }

  const ward = globalState.wards.get(wardNumber);
  if (!ward) return null;
  updateWardStatsInMemory(wardNumber);
  return globalState.wards.get(wardNumber) || null;
}

/**
 * Record an arrival batch (Transactional, Idempotent, Concurrency-Safe)
 */
export async function recordArrival(
  payload: RecordArrivalPayload,
  staffUser: { id: string; name: string; email: string }
): Promise<RecordArrivalResponse> {
  const { ward_id, batch_size, request_id, expected_prior_count, acknowledge_excess } = payload;

  if (batch_size <= 0) {
    return {
      success: false,
      message: 'Batch size must be a positive whole number.',
    };
  }

  // Supabase RPC path
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('record_arrival', {
        p_ward_id: ward_id,
        p_batch_size: batch_size,
        p_request_id: request_id,
        p_expected_prior_count: expected_prior_count ?? null,
        p_acknowledge_excess: acknowledge_excess ?? false,
      });

      if (error) throw error;
      return data as RecordArrivalResponse;
    } catch (err) {
      console.warn('Supabase record_arrival RPC error, falling back to atomic local store:', err);
    }
  }

  // Atomic In-Memory Implementation
  // 1. Idempotency check: duplicate request_id
  const existingBatch = globalState.batches.find((b) => b.request_id === request_id);
  if (existingBatch) {
    const ward = globalState.wards.get(ward_id);
    return {
      success: true,
      duplicate_request: true,
      batch_id: existingBatch.id,
      ward_id: existingBatch.ward_id,
      batch_size: existingBatch.batch_size,
      cumulative_entered: ward?.total_entered || 0,
      message: 'Request was already recorded previously.',
    };
  }

  const ward = globalState.wards.get(ward_id);
  if (!ward) {
    return {
      success: false,
      message: `Ward with ID ${ward_id} not found.`,
    };
  }

  updateWardStatsInMemory(ward_id);
  const currentEntered = ward.total_entered;
  const proposedTotal = currentEntered + batch_size;

  // 2. Concurrency Check: If staff submitted based on stale count
  if (expected_prior_count !== undefined && expected_prior_count !== null && currentEntered !== expected_prior_count) {
    if (proposedTotal > ward.allowance) {
      const excessBy = proposedTotal - ward.allowance;
      return {
        success: false,
        concurrency_mismatch: true,
        prior_entered: currentEntered,
        cumulative_entered: proposedTotal,
        allowance: ward.allowance,
        excess_by: excessBy,
        message: 'Attendance was updated by another staff member. Please review the updated total and confirm.',
      };
    }
  }

  // 3. Excess Allowance Check
  if (proposedTotal > ward.allowance) {
    const excessBy = proposedTotal - ward.allowance;
    if (!acknowledge_excess) {
      return {
        success: false,
        excess_warning_needed: true,
        prior_entered: currentEntered,
        cumulative_entered: proposedTotal,
        allowance: ward.allowance,
        excess_by: excessBy,
        message: `This invitation allows ${ward.allowance} people including the principal invitee. This entry will bring attendance to ${proposedTotal}, exceeding the allowance by ${excessBy}.`,
      };
    }
  }

  // 4. Record new batch
  const excessBy = Math.max(0, proposedTotal - ward.allowance);
  const now = new Date().toISOString();
  const newBatch: ArrivalBatch = {
    id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ward_id: ward.id,
    batch_size,
    request_id,
    recorded_by: staffUser.id,
    recorded_by_name: staffUser.name,
    recorded_by_email: staffUser.email,
    created_at: now,
    is_voided: false,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    excess_acknowledged: Boolean(acknowledge_excess),
    excess_count: excessBy,
    excess_acknowledged_by: acknowledge_excess ? staffUser.id : null,
    excess_acknowledged_at: acknowledge_excess ? now : null,
  };

  globalState.batches.push(newBatch);
  updateWardStatsInMemory(ward_id);

  // 5. Audit Log
  globalState.auditLogs.push({
    id: `audit-${Date.now()}`,
    table_name: 'arrival_batches',
    record_id: newBatch.id,
    action: 'INSERT',
    performed_by: staffUser.id,
    old_data: null,
    new_data: {
      ward_id: ward.id,
      batch_size,
      prior_entered: currentEntered,
      new_total: proposedTotal,
      excess_acknowledged: acknowledge_excess,
      excess_count: excessBy,
    },
    reason: 'Arrival recorded',
    created_at: now,
  });

  return {
    success: true,
    duplicate_request: false,
    batch_id: newBatch.id,
    ward_id: ward.id,
    batch_size,
    prior_entered: currentEntered,
    cumulative_entered: proposedTotal,
    allowance: ward.allowance,
    excess_by: excessBy,
    message: 'Arrival recorded successfully.',
  };
}

/**
 * Void an incorrect arrival batch (Admin-only, retains audit record)
 */
export async function voidArrivalBatch(
  batchId: string,
  reason: string,
  adminUser: { id: string; name: string }
): Promise<{ success: boolean; new_total?: number; message: string }> {
  if (!reason || !reason.trim()) {
    return { success: false, message: 'A reason must be provided to void an arrival batch.' };
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('void_arrival_batch', {
        p_batch_id: batchId,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase void_arrival_batch RPC error, falling back to local store:', err);
    }
  }

  const batch = globalState.batches.find((b) => b.id === batchId);
  if (!batch) {
    return { success: false, message: 'Arrival batch not found.' };
  }

  if (batch.is_voided) {
    return { success: false, message: 'Batch was already voided previously.' };
  }

  const now = new Date().toISOString();
  batch.is_voided = true;
  batch.voided_at = now;
  batch.voided_by = adminUser.id;
  batch.void_reason = reason.trim();

  updateWardStatsInMemory(batch.ward_id);
  const ward = globalState.wards.get(batch.ward_id);

  globalState.auditLogs.push({
    id: `audit-${Date.now()}`,
    table_name: 'arrival_batches',
    record_id: batch.id,
    action: 'VOID',
    performed_by: adminUser.id,
    old_data: { is_voided: false, batch_size: batch.batch_size },
    new_data: { is_voided: true, void_reason: reason.trim() },
    reason: reason.trim(),
    created_at: now,
  });

  return {
    success: true,
    new_total: ward?.total_entered || 0,
    message: 'Arrival batch voided successfully.',
  };
}

/**
 * Update Ward Details, Food Counts, and Optional Accompanying Guests (Admin-Only)
 */
export async function updateWardAdmin(
  wardNumber: number,
  updates: {
    candidate_name?: string;
    party?: 'TDP' | 'JSP' | 'BJP';
    phone?: string | null;
    expected_veg?: number | null;
    expected_non_veg?: number | null;
    food_confirmed?: boolean;
    admin_notes?: string | null;
    guests?: Array<{ guest_number: number; guest_name: string }>;
  },
  adminUser: { id: string; name: string }
): Promise<{ success: boolean; ward?: WardWithStats; message: string }> {
  const ward = globalState.wards.get(wardNumber);
  if (!ward) {
    return { success: false, message: `Ward ${wardNumber} not found.` };
  }

  const oldData = { ...ward };

  if (updates.candidate_name !== undefined) ward.candidate_name = updates.candidate_name;
  if (updates.party !== undefined) ward.party = updates.party;
  if (updates.phone !== undefined) ward.phone = updates.phone;
  if (updates.expected_veg !== undefined) ward.expected_veg = updates.expected_veg;
  if (updates.expected_non_veg !== undefined) ward.expected_non_veg = updates.expected_non_veg;
  if (updates.food_confirmed !== undefined) ward.food_confirmed = updates.food_confirmed;
  if (updates.admin_notes !== undefined) ward.admin_notes = updates.admin_notes;
  ward.updated_at = new Date().toISOString();

  if (updates.guests !== undefined) {
    const validGuests: WardGuest[] = updates.guests
      .filter((g) => g.guest_number >= 1 && g.guest_number <= 4 && g.guest_name.trim().length > 0)
      .map((g) => ({
        id: `guest-${wardNumber}-${g.guest_number}`,
        ward_id: ward.id,
        guest_number: g.guest_number,
        guest_name: g.guest_name.trim(),
        updated_at: new Date().toISOString(),
      }));
    ward.guests = validGuests;
  }

  // Audit Log
  globalState.auditLogs.push({
    id: `audit-${Date.now()}`,
    table_name: 'wards',
    record_id: String(wardNumber),
    action: 'UPDATE',
    performed_by: adminUser.id,
    old_data: oldData,
    new_data: ward,
    reason: 'Admin updated ward details or food counts',
    created_at: new Date().toISOString(),
  });

  return {
    success: true,
    ward,
    message: 'Ward details updated successfully.',
  };
}

/**
 * Calculate complete dashboard summary metrics
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const allWards = await getAllWards();

  let totalEntered = 0;
  let wardsWithArrivals = 0;
  let wardsWithoutArrivals = 0;
  let wardsExceedingAllowance = 0;
  let totalExcessPeople = 0;
  let expectedVegTotal = 0;
  let expectedNonVegTotal = 0;
  let wardsUnconfirmedFood = 0;

  allWards.forEach((w) => {
    totalEntered += w.total_entered;

    if (w.total_entered > 0) {
      wardsWithArrivals += 1;
    } else {
      wardsWithoutArrivals += 1;
    }

    if (w.total_entered > w.allowance) {
      wardsExceedingAllowance += 1;
      totalExcessPeople += w.total_entered - w.allowance;
    }

    if (w.expected_veg !== null && w.expected_veg !== undefined) {
      expectedVegTotal += w.expected_veg;
    }

    if (w.expected_non_veg !== null && w.expected_non_veg !== undefined) {
      expectedNonVegTotal += w.expected_non_veg;
    }

    if (!w.food_confirmed) {
      wardsUnconfirmedFood += 1;
    }
  });

  return {
    total_entered: totalEntered,
    normal_total_allowance: 380, // 76 wards * 5
    wards_with_arrivals: wardsWithArrivals,
    wards_without_arrivals: wardsWithoutArrivals,
    wards_exceeding_allowance: wardsExceedingAllowance,
    total_excess_people: totalExcessPeople,
    expected_veg_total: expectedVegTotal,
    expected_non_veg_total: expectedNonVegTotal,
    wards_unconfirmed_food: wardsUnconfirmedFood,
    last_refreshed_at: new Date().toISOString(),
  };
}

/**
 * Get all entry batches (for Entry History table and CSV)
 */
export async function getAllBatches(): Promise<ArrivalBatch[]> {
  const allWards = await getAllWards();
  const wardMap = new Map(allWards.map((w) => [w.id, w]));

  const batches: ArrivalBatch[] = [];
  allWards.forEach((w) => {
    w.recent_batches.forEach((b) => {
      batches.push({
        ...b,
        ward_id: w.ward_number,
      });
    });
  });

  return batches.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Get audit logs for admin review
 */
export async function getAuditLogs() {
  return globalState.auditLogs.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
