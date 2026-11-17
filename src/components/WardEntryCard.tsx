'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Utensils,
  ArrowLeft,
  RefreshCw,
  QrCode,
  ShieldAlert,
  UserCheck,
  Phone
} from 'lucide-react';
import { WardWithStats, RecordArrivalResponse } from '@/types/database';
import { PartyBadge } from '@/components/PartyBadge';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { isWinningWard, getWinningCorporator } from '@/lib/candidatePhotos';
import { formatInKolkataTime } from '@/lib/utils/date';
import { WARDS_SEED_DATA } from '@/data/wardsSeed';
import {
  getCachedWard,
  updateCachedWards,
  recordArrivalOptimistic,
  flushPendingQueue,
} from '@/lib/offline/offlineSync';

interface WardEntryCardProps {
  wardNumber: number;
  onScanNext: () => void;
  isAdmin?: boolean;
  onEditWard?: () => void;
  initialWardData?: WardWithStats;
}

export function WardEntryCard({
  wardNumber,
  onScanNext,
  isAdmin = false,
  onEditWard,
  initialWardData,
}: WardEntryCardProps) {
  const seedWard = WARDS_SEED_DATA.find((w) => w.ward_number === wardNumber);
  const defaultFallbackWard: WardWithStats | null = seedWard
    ? {
        id: seedWard.ward_number,
        ward_number: seedWard.ward_number,
        candidate_name: seedWard.candidate_name,
        party: seedWard.party,
        allowance: 5,
        phone: seedWard.phone || null,
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
      }
    : null;

  // Immediate rendering: loads from offline cache or pre-seeded data in 0ms (zero wait time)
  const [ward, setWard] = useState<WardWithStats | null>(() => {
    return initialWardData || getCachedWard(wardNumber) || defaultFallbackWard;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form State
  const [arrivingCount, setArrivingCount] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [successResponse, setSuccessResponse] = useState<RecordArrivalResponse | null>(null);

  // Excess Warning Dialog State
  const [showExcessWarning, setShowExcessWarning] = useState<boolean>(false);
  const [excessWarningDetails, setExcessWarningDetails] = useState<{
    proposedTotal: number;
    excessBy: number;
  } | null>(null);

  // Unique Request ID for idempotency (persists across retries for the same attempt)
  const currentRequestIdRef = useRef<string>(crypto.randomUUID());

  // Silent background revalidation (SWR pattern) - never blocks UI with a full-screen spinner
  const loadWardData = async (showSpinner: boolean = false) => {
    try {
      if (showSpinner) setLoading(true);
      setFetchError(null);
      const res = await fetch(`/api/wards/${wardNumber}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load division invitation.');
      }
      setWard(data.ward);
      updateCachedWards([data.ward]);
    } catch (err: unknown) {
      // If we already have cached data in 'ward', suppress error and allow smooth offline operation
      console.warn('Background ward sync skipped (offline or weak network):', err);
      if (!ward) {
        const msg = err instanceof Error ? err.message : 'Error loading division details.';
        setFetchError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Immediately display from instant offline cache
    const instantWard = initialWardData || getCachedWard(wardNumber) || defaultFallbackWard;
    if (instantWard) {
      setWard(instantWard);
    }
    // 2. Silent background sync without blocking screen
    loadWardData(false);
    currentRequestIdRef.current = crypto.randomUUID();
    setSuccessResponse(null);
    setSubmissionError(null);
    setShowExcessWarning(false);
    setArrivingCount(1);
  }, [wardNumber, initialWardData]);

  // Handle Arrival Submission with Instant Optimistic UI + Offline Queue
  const handleRecordArrival = async (acknowledgeExcess: boolean = false) => {
    if (!ward) return;

    // Validate arriving count
    if (!arrivingCount || arrivingCount < 1 || !Number.isInteger(arrivingCount)) {
      setSubmissionError('Please enter a valid positive whole number of people.');
      return;
    }

    const proposedTotal = ward.total_entered + arrivingCount;

    // Client-side preemptive excess check
    if (proposedTotal > ward.allowance && !acknowledgeExcess) {
      setExcessWarningDetails({
        proposedTotal,
        excessBy: proposedTotal - ward.allowance,
      });
      setShowExcessWarning(true);
      return;
    }

    try {
      setSubmitting(true);
      setSubmissionError(null);

      const payload = {
        ward_id: ward.id,
        batch_size: arrivingCount,
        request_id: currentRequestIdRef.current,
        expected_prior_count: ward.total_entered,
        acknowledge_excess: acknowledgeExcess,
      };

      // 1. Optimistic Local Record: update screen immediately in 0ms!
      const { ward: updatedWard, response: localResp } = recordArrivalOptimistic(
        payload,
        'Staff',
        ward.ward_number
      );
      setWard(updatedWard);

      // 2. Attempt server sync
      try {
        const res = await fetch('/api/arrivals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data: RecordArrivalResponse = await res.json();

        if (res.ok && data.success) {
          setSuccessResponse(data);
          const newEntered = data.cumulative_entered ?? updatedWard.total_entered;
          setWard((prev) => {
            if (!prev) return updatedWard;
            return {
              ...prev,
              total_entered: newEntered,
              remaining_allowance: Math.max(0, prev.allowance - newEntered),
              excess_count: Math.max(0, newEntered - prev.allowance),
            };
          });
          flushPendingQueue().catch(() => {});
        } else if (data.concurrency_mismatch || data.excess_warning_needed) {
          setShowExcessWarning(true);
          setExcessWarningDetails({
            proposedTotal: data.cumulative_entered || (data.prior_entered || 0) + arrivingCount,
            excessBy: data.excess_by || Math.max(0, (data.cumulative_entered || 0) - (ward?.allowance || 5)),
          });
          setSubmissionError(data.message || 'Attendance was updated. Please re-confirm.');
          await loadWardData();
          return;
        } else {
          console.warn('Server record_arrival returned error:', data);
          setSubmissionError(data.message || 'Error recording attendance on server.');
          await loadWardData();
          return;
        }
      } catch (networkErr) {
        // Network unavailable or slow - user gets immediate success!
        console.warn('Network unreachable, arrival saved to local sync queue:', networkErr);
        setSuccessResponse({
          ...localResp,
          message: 'Saved locally in Offline Mode. Will auto-sync when connection restores.',
        });
      }

      setShowExcessWarning(false);
      // Broadcast instant sync to all local tabs/windows
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('brk_sync_channel');
          bc.postMessage({ type: 'ARRIVAL_RECORDED', ward_id: ward.id, ward_number: ward.ward_number });
          bc.close();
        } catch {}
      }
      // Reload updated ward state
      await loadWardData();
      // Prepare new request ID for any next submission
      currentRequestIdRef.current = crypto.randomUUID();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error. Attendance was NOT recorded.';
      setSubmissionError(msg);
      // Notice: Do NOT change currentRequestIdRef so retry sends same ID for idempotency!
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Loading Division {wardNumber} details...</p>
      </div>
    );
  }

  if (fetchError || !ward) {
    return (
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Division Not Found</h3>
        <p className="text-sm text-slate-600 mt-1">{fetchError || 'Unable to retrieve division details.'}</p>
        <button
          onClick={onScanNext}
          className="mt-5 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
        >
          Scan Another Invitation
        </button>
      </div>
    );
  }

  const isAtOrExceeded = ward.total_entered >= ward.allowance;
  const isOverAllowance = ward.total_entered > ward.allowance;
  const winningCorp = getWinningCorporator(ward.ward_number);
  const isWinner = isWinningWard(ward.ward_number);
  const isSpecial = ward.ward_number >= 101 || ['VIP', 'SPECIAL', 'GUEST', 'ALLIANCE'].includes(ward.party);

  return (
    <div className="w-full max-w-lg flex flex-col gap-4 pb-12 sm:pb-4">
      {/* SUCCESS CONFIRMATION BANNER */}
      {successResponse && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 shadow-sm text-emerald-950 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-base sm:text-lg text-emerald-900">
                Attendance Recorded Successfully!
              </h3>
              <p className="text-xs sm:text-sm text-emerald-800 mt-1">
                Recorded {successResponse.batch_size} {successResponse.batch_size === 1 ? 'person' : 'people'} for Division {ward.ward_number}.
                {successResponse.duplicate_request && ' (Idempotent confirmation)'}
              </p>
              <div className="mt-2 text-xs font-semibold bg-emerald-100 text-emerald-900 px-3 py-1.5 rounded-lg inline-block">
                Cumulative Attendance: {successResponse.cumulative_entered} / {ward.allowance} allowance
                {(successResponse.excess_by || 0) > 0 && ` (${successResponse.excess_by} excess)`}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setSuccessResponse(null);
              onScanNext();
            }}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm sm:text-base shadow-sm flex items-center justify-center gap-2 transition"
          >
            <QrCode className="w-5 h-5" />
            <span>Scan Next Invitation</span>
          </button>
        </div>
      )}

      {/* MAIN DIVISION INVITATION CARD */}
      <div className="bg-white rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.06)] border border-black/[0.06] overflow-hidden">
            {/* Non-winning warning notice if applicable */}
            {!isWinner && !isSpecial && (
              <div className="mx-5 sm:mx-6 mt-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Non-Winning Division:</strong> Division {ward.ward_number} is not among the 64 winning corporators invited to this grand felicitation event.
                </div>
              </div>
            )}

            {/* Special Guest Dignitary Banner */}
            {isSpecial && (
              <div className="mx-5 sm:mx-6 mt-5 p-3.5 rounded-2xl bg-purple-50 border border-purple-200/80 text-purple-900 flex items-start gap-2.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Special Dignitary Pass:</strong> Official registered pass for honored guest and accompanying entourage.
                </div>
              </div>
            )}

            {/* Card Header: Refined Apple aesthetic with party badge & squircle */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-black/[0.06] bg-white">
              <div className="flex items-center gap-3.5">
                <span
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg shadow-2xs border ${
                    ward.party === 'TDP'
                      ? 'bg-[#FFF6CC] text-[#7A5B00] border-[#FFCC00]/40'
                      : ward.party === 'JSP'
                      ? 'bg-[#FFEBEA] text-[#D70015] border-[#FF3B30]/30'
                      : ward.party === 'BJP'
                      ? 'bg-[#FFF1E5] text-[#C93400] border-[#FF9500]/30'
                      : 'bg-purple-100 text-purple-800 border-purple-200'
                  }`}
                >
                  {ward.ward_number}
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-500 font-medium block">
                      {isSpecial ? 'Special Dignitary Pass' : 'Official Invitation'}
                    </span>
                    {isWinner && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
                        WINNER
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-neutral-900 tracking-tight leading-snug">
                    {isSpecial ? `Pass #${ward.ward_number}` : `Division ${ward.ward_number}`}
                  </h2>
                </div>
              </div>

              {!isSpecial && <PartyBadge party={ward.party} size="md" />}
            </div>

            {/* Candidate Details with Portrait Photo */}
            <div className="p-5 sm:p-6 border-b border-black/[0.06] bg-neutral-50/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                  {/* Photo or Fallback User Icon */}
                  <CandidateAvatar
                    wardNumber={ward.ward_number}
                    candidateName={winningCorp ? winningCorp.nameEn : ward.candidate_name}
                    candidateNameTe={winningCorp ? winningCorp.nameTe : undefined}
                    party={ward.party}
                    size="lg"
                    showWinnerRing={isWinner}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-neutral-500 font-medium">Principal Invitee / Candidate</span>
                      {isWinner ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-900 border border-amber-500/30">
                          ★ Winner
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-200/70 text-neutral-600">
                          Non-Winner
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-neutral-900 mt-0.5 tracking-tight truncate">
                      {winningCorp ? (
                        <span>
                          {winningCorp.nameTe}{' '}
                          <span className="text-xs sm:text-sm font-semibold text-neutral-600 font-normal">
                            ({winningCorp.nameEn})
                          </span>
                        </span>
                      ) : (
                        ward.candidate_name
                      )}
                    </h3>

                    {ward.phone && (
                      <div className="flex items-center gap-2 mt-2">
                        <a
                          href={`tel:${ward.phone}`}
                          className="text-xs text-neutral-700 hover:text-blue-600 font-medium font-mono flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-black/[0.08] shadow-2xs transition-colors"
                          title="Click to Call"
                        >
                          <Phone className="w-3 h-3 text-neutral-400" />
                          <span>{ward.phone}</span>
                        </a>
                        <WhatsAppButton ward={ward} variant="pill" />
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && onEditWard && (
                  <button
                    onClick={onEditWard}
                    className="text-xs font-medium px-3 py-1.5 text-neutral-700 bg-white border border-black/[0.08] rounded-xl hover:bg-neutral-50 shadow-2xs transition-colors shrink-0"
                  >
                    Edit Details
                  </button>
                )}
              </div>

          {/* Accompanying Guests (if recorded) */}
          {ward.guests && ward.guests.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-black/[0.06]">
              <span className="text-xs font-medium text-neutral-600 block mb-1.5">
                Accompanying Guests ({ward.guests.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ward.guests.map((g) => (
                  <span
                    key={g.guest_number}
                    className="text-xs bg-neutral-200/70 text-neutral-800 px-2.5 py-1 rounded-lg font-medium"
                  >
                    {g.guest_number}. {g.guest_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ATTENDANCE COUNTERS */}
        <div className="p-6 border-b border-black/[0.06]">
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
            {/* Total Allowance */}
            <div className="bg-neutral-50 rounded-2xl p-4 border border-black/[0.04]">
              <span className="text-xs font-medium text-neutral-500 block">
                Allowance
              </span>
              <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 mt-1 block">
                {ward.allowance}
              </span>
              <span className="text-[11px] text-neutral-400 block mt-0.5">Total people</span>
            </div>

            {/* Previously Entered */}
            <div className={`rounded-2xl p-4 border ${
              isOverAllowance
                ? 'bg-rose-50/70 border-rose-200/80'
                : 'bg-emerald-50/70 border-emerald-200/80'
            }`}>
              <span className="text-xs font-medium text-neutral-600 block">
                Entered
              </span>
              <span
                className={`text-2xl sm:text-3xl font-semibold tracking-tight mt-1 block ${
                  isOverAllowance ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {ward.total_entered}
              </span>
              <span className="text-[11px] text-neutral-500 block mt-0.5">People entered</span>
            </div>

            {/* Remaining or Excess */}
            <div className={`rounded-2xl p-4 border ${
              isOverAllowance
                ? 'bg-rose-50/70 border-rose-200/80'
                : 'bg-amber-50/70 border-amber-200/80'
            }`}>
              <span className="text-xs font-medium text-neutral-600 block">
                {isOverAllowance ? 'Excess' : 'Remaining'}
              </span>
              <span
                className={`text-2xl sm:text-3xl font-semibold tracking-tight mt-1 block ${
                  isOverAllowance ? 'text-rose-700' : 'text-amber-800'
                }`}
              >
                {isOverAllowance ? `+${ward.excess_count}` : ward.remaining_allowance}
              </span>
              <span className="text-[11px] text-neutral-500 block mt-0.5">
                {isOverAllowance ? 'Above allowance' : 'Slots left'}
              </span>
            </div>
          </div>

          {/* Status Message */}
          {isOverAllowance && (
            <div className="mt-3.5 flex items-center gap-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200/80 px-3.5 py-2.5 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Pass has already exceeded the {ward.allowance}-person allowance by {ward.excess_count} people.
              </span>
            </div>
          )}

          {isAtOrExceeded && !isOverAllowance && (
            <div className="mt-3.5 flex items-center gap-2 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200/80 px-3.5 py-2.5 rounded-xl">
              <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Pass has reached its exact {ward.allowance}-person allowance.</span>
            </div>
          )}
        </div>

        {/* FOOD PLANNING INFORMATION */}
        <div className="px-6 py-4 bg-neutral-50/80 border-b border-black/[0.06] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-neutral-700">
            <Utensils className="w-4 h-4 text-neutral-500" />
            <span className="font-medium">Food Planning:</span>
            <span>
              Veg: <strong className="text-neutral-900 font-semibold">{ward.expected_veg !== null ? ward.expected_veg : 'Unset'}</strong>, Non-veg:{' '}
              <strong className="text-neutral-900 font-semibold">{ward.expected_non_veg !== null ? ward.expected_non_veg : 'Unset'}</strong>
            </span>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full font-medium text-[11px] ${
              ward.food_confirmed
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                : 'bg-amber-50 text-amber-800 border border-amber-200/60'
            }`}
          >
            {ward.food_confirmed ? 'Confirmed' : 'Unconfirmed'}
          </span>
        </div>

        {/* PREVIOUS ARRIVAL BATCHES */}
        {ward.recent_batches && ward.recent_batches.length > 0 && (
          <div className="p-6 border-b border-black/[0.06]">
            <h4 className="text-xs font-medium text-neutral-500 mb-2.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Previous Arrival Batches ({ward.recent_batches.length})</span>
            </h4>

            <div className="divide-y divide-black/[0.04] max-h-40 overflow-y-auto">
              {ward.recent_batches.map((batch) => (
                <div key={batch.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium text-neutral-900">
                      +{batch.batch_size} {batch.batch_size === 1 ? 'person' : 'people'}
                      {batch.excess_acknowledged && (
                        <span className="ml-1.5 text-[10px] text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded-md font-medium">
                          Excess Ack
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-neutral-400 mt-0.5">
                      {formatInKolkataTime(batch.created_at)} • by {batch.recorded_by_name || 'Staff'}
                    </span>
                  </div>

                  {batch.is_voided ? (
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60 text-[10px] font-medium">
                      Voided: {batch.void_reason || 'Incorrect'}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium text-[11px]">Recorded</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ARRIVAL ENTRY FORM */}
        <div className="p-6 bg-white">
          <label htmlFor="arrivingInput" className="block text-sm font-semibold text-neutral-900 mb-1">
            People Arriving Now
          </label>
          <p className="text-xs text-neutral-500 mb-3.5 font-normal">
            Positive whole number only. Scanning alone does not mark arrivals.
          </p>

          <div className="flex items-center gap-3">
            <div className="relative w-28">
              <input
                id="arrivingInput"
                type="number"
                min="1"
                step="1"
                value={arrivingCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setArrivingCount(isNaN(val) ? 1 : val);
                  setShowExcessWarning(false);
                  setSubmissionError(null);
                }}
                className="w-full text-center text-xl font-semibold py-2.5 bg-neutral-50/80 focus:bg-white border border-neutral-300 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-neutral-900 outline-none"
              />
            </div>

            {/* Quick Increment Buttons (Apple Segmented Style) */}
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setArrivingCount(num);
                    setShowExcessWarning(false);
                    setSubmissionError(null);
                  }}
                  className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all active:scale-[0.98] ${
                    arrivingCount === num
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-neutral-100 text-neutral-700 border-neutral-200/70 hover:bg-neutral-200/70'
                  }`}
                >
                  +{num}
                </button>
              ))}
            </div>
          </div>

          {/* Submission Error Banner */}
          {submissionError && !showExcessWarning && (
            <div className="mt-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{submissionError}</span>
            </div>
          )}

          {/* Record Arrival Action Button */}
          {!showExcessWarning && (
            <button
              onClick={() => handleRecordArrival(false)}
              disabled={submitting}
              className="mt-5 w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-sm sm:text-base rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-neutral-300" />
                  <span>Confirming Database Write...</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>Record {arrivingCount} {arrivingCount === 1 ? 'Arrival' : 'Arrivals'}</span>
                </>
              )}
            </button>
          )}

          {/* EXCESS WARNING DIALOG / BANNER */}
          {showExcessWarning && excessWarningDetails && (
            <div className="mt-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-amber-950">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-amber-900">
                    Allowance Exceeded Warning
                  </h4>
                  <p className="text-xs text-amber-800 mt-1 font-normal leading-relaxed">
                    This invitation allows {ward.allowance} {ward.allowance === 1 ? 'person' : 'people'} including the principal invitee. This entry will bring attendance to{' '}
                    <span className="font-semibold underline">{excessWarningDetails.proposedTotal}</span>, exceeding the allowance by{' '}
                    <span className="font-semibold underline">{excessWarningDetails.excessBy}</span>.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowExcessWarning(false);
                    setSubmissionError(null);
                  }}
                  disabled={submitting}
                  className="w-full sm:flex-1 py-3 bg-white border border-neutral-300 text-neutral-700 font-semibold text-xs sm:text-sm rounded-xl hover:bg-neutral-50 shadow-2xs transition-colors cursor-pointer"
                >
                  Go Back
                </button>

                <button
                  type="button"
                  onClick={() => handleRecordArrival(true)}
                  disabled={submitting}
                  className="w-full sm:flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      <span>Confirm Excess Entry (+{excessWarningDetails.excessBy})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card Footer: Back to Scanner (Apple Style) */}
        <div className="p-4 bg-neutral-50/70 border-t border-black/[0.06] flex items-center justify-between">
          <button
            onClick={onScanNext}
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Scan Another Division</span>
          </button>

          <span className="text-[11px] text-neutral-400 font-mono">
            ID: {currentRequestIdRef.current.substring(0, 8)}
          </span>
        </div>
      </div>
    </div>
  );
}

