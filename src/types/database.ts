export type StaffRole = 'admin' | 'scanner';

export type PartyAffiliation = 'TDP' | 'JSP' | 'BJP';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  created_at?: string;
  updated_at?: string;
}

export interface WardRecord {
  id: number;
  ward_number: number;
  candidate_name: string;
  party: PartyAffiliation;
  allowance: number; // Always 5
  phone: string | null;
  expected_veg: number | null;
  expected_non_veg: number | null;
  food_confirmed: boolean;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WardGuest {
  id: string;
  ward_id: number;
  guest_number: number; // 1 to 4
  guest_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface ArrivalBatch {
  id: string;
  ward_id: number;
  batch_size: number;
  request_id: string;
  recorded_by: string;
  recorded_by_name?: string;
  recorded_by_email?: string;
  created_at: string;
  is_voided: boolean;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  excess_acknowledged: boolean;
  excess_count: number;
  excess_acknowledged_by: string | null;
  excess_acknowledged_at: string | null;
}

export interface WardWithStats extends WardRecord {
  total_entered: number;
  remaining_allowance: number;
  excess_count: number;
  guests: WardGuest[];
  recent_batches: ArrivalBatch[];
}

export interface DashboardSummary {
  total_entered: number;
  normal_total_allowance: number; // 380
  wards_with_arrivals: number;
  wards_without_arrivals: number;
  wards_exceeding_allowance: number;
  total_excess_people: number;
  expected_veg_total: number;
  expected_non_veg_total: number;
  wards_unconfirmed_food: number;
  last_refreshed_at: string;
}

export interface RecordArrivalPayload {
  ward_id: number;
  batch_size: number;
  request_id: string;
  expected_prior_count?: number;
  acknowledge_excess?: boolean;
}

export interface RecordArrivalResponse {
  success: boolean;
  batch_id?: string;
  ward_id?: number;
  batch_size?: number;
  prior_entered?: number;
  cumulative_entered?: number;
  allowance?: number;
  excess_by?: number;
  excess_warning_needed?: boolean;
  concurrency_mismatch?: boolean;
  duplicate_request?: boolean;
  message?: string;
}

export interface VoidBatchPayload {
  batch_id: string;
  reason: string;
}
