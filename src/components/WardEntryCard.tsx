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
import { formatInKolkataTime } from '@/lib/utils/date';
import { WARDS_SEED_DATA } from '@/data/wardsSeed';

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

  // Immediate rendering: starts with initial or pre-seeded data, zero wait time
  const [ward, setWard] = useState<WardWithStats | null>(initialWardData || defaultFallbackWard);
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

  // Fetch live ward details in background (SWR pattern)
  const loadWardData = async (showSpinner: boolean = false) => {
    try {
      if (showSpinner) setLoading(true);
      setFetchError(null);
      const res = await fetch(`/api/wards/${wardNumber}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load ward invitation.');
      }
      setWard(data.ward);
    } catch (err: unknown) {
      if (!ward) {
        const msg = err instanceof Error ? err.message : 'Error loading ward details.';
        setFetchError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If initial ward data is passed, use it immediately
    if (initialWardData) {
      setWard(initialWardData);
    }
    loadWardData(!initialWardData && !defaultFallbackWard);
    currentRequestIdRef.current = crypto.randomUUID();
    setSuccessResponse(null);
    setSubmissionError(null);
    setShowExcessWarning(false);
    setArrivingCount(1);
  }, [wardNumber, initialWardData]);

  // Handle Arrival Submission
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

      const res = await fetch('/api/arrivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: RecordArrivalResponse = await res.json();

      if (!res.ok || !data.success) {
        // Concurrency mismatch or server excess warning required
        if (data.concurrency_mismatch || data.excess_warning_needed) {
          setShowExcessWarning(true);
          setExcessWarningDetails({
            proposedTotal: data.cumulative_entered || (data.prior_entered || 0) + arrivingCount,
            excessBy: data.excess_by || Math.max(0, (data.cumulative_entered || 0) - 5),
          });
          setSubmissionError(data.message || 'Attendance was updated. Please re-confirm.');
          // Refresh ward data to get the latest count
          await loadWardData();
          return;
        }

        throw new Error(data.message || 'Failed to record entry. Please retry.');
      }

      // Success confirmed by DB!
      setSuccessResponse(data);
      setShowExcessWarning(false);
      // Broadcast instant sync to all local tabs/windows
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('brk_sync_channel');
          bc.postMessage({ type: 'ARRIVAL_RECORDED', ward_id: ward.id });
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
        <p className="text-sm font-medium text-slate-600">Loading Ward {wardNumber} details...</p>
      </div>
    );
  }

  if (fetchError || !ward) {
    return (
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Ward Not Found</h3>
        <p className="text-sm text-slate-600 mt-1">{fetchError || 'Unable to retrieve ward details.'}</p>
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

  return (
    <div className="w-full max-w-lg flex flex-col gap-4">
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
                Recorded {successResponse.batch_size} {successResponse.batch_size === 1 ? 'person' : 'people'} for Ward {ward.ward_number}.
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

      {/* MAIN WARD INVITATION CARD */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Card Header: Ward Number & Party */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg">
              {ward.ward_number}
            </span>
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">
                Official Invitation
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Ward {ward.ward_number}
              </h2>
            </div>
          </div>

          <PartyBadge party={ward.party} size="md" />
        </div>

        {/* Candidate Details */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Principal Invitee / Candidate</span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">{ward.candidate_name}</h3>
              {ward.phone && (
                <div className="flex items-center gap-2 mt-2">
                  <a
                    href={`tel:${ward.phone}`}
                    className="text-xs text-slate-700 hover:text-blue-600 font-bold font-mono flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 transition"
                    title="Click to Call"
                  >
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{ward.phone}</span>
                  </a>
                  <WhatsAppButton ward={ward} variant="pill" />
                </div>
              )}
            </div>

            {isAdmin && onEditWard && (
              <button
                onClick={onEditWard}
                className="text-xs font-semibold px-2.5 py-1 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Edit Details
              </button>
            )}
          </div>

          {/* Accompanying Guests (if recorded) */}
          {ward.guests && ward.guests.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200/80">
              <span className="text-xs font-semibold text-slate-600 block mb-1">
                Accompanying Guests ({ward.guests.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ward.guests.map((g) => (
                  <span
                    key={g.guest_number}
                    className="text-xs bg-slate-200/70 text-slate-800 px-2 py-0.5 rounded font-medium"
                  >
                    {g.guest_number}. {g.guest_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ATTENDANCE COUNTERS */}
        <div className="p-5 border-b border-slate-100">
          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            {/* Total Allowance */}
            <div className="bg-slate-100 rounded-xl p-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Allowance
              </span>
              <span className="text-2xl font-black text-slate-800">{ward.allowance}</span>
              <span className="text-[10px] text-slate-500 block">Total people</span>
            </div>

            {/* Previously Entered */}
            <div className={`rounded-xl p-3 ${isOverAllowance ? 'bg-rose-100' : 'bg-emerald-50'}`}>
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Entered
              </span>
              <span
                className={`text-2xl font-black ${
                  isOverAllowance ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {ward.total_entered}
              </span>
              <span className="text-[10px] text-slate-500 block">People entered</span>
            </div>

            {/* Remaining or Excess */}
            <div className={`rounded-xl p-3 ${isOverAllowance ? 'bg-rose-100' : 'bg-amber-50'}`}>
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                {isOverAllowance ? 'Excess' : 'Remaining'}
              </span>
              <span
                className={`text-2xl font-black ${
                  isOverAllowance ? 'text-rose-700' : 'text-amber-700'
                }`}
              >
                {isOverAllowance ? `+${ward.excess_count}` : ward.remaining_allowance}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {isOverAllowance ? 'Above allowance' : 'Slots left'}
              </span>
            </div>
          </div>

          {/* Status Message */}
          {isOverAllowance && (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Ward has already exceeded the 5-person allowance by {ward.excess_count} people.
              </span>
            </div>
          )}

          {isAtOrExceeded && !isOverAllowance && (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
              <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Ward has reached its exact 5-person allowance.</span>
            </div>
          )}
        </div>

        {/* FOOD PLANNING INFORMATION */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Utensils className="w-4 h-4 text-slate-500" />
            <span className="font-semibold">Food Planning:</span>
            <span>
              Veg: <strong>{ward.expected_veg !== null ? ward.expected_veg : 'Unset'}</strong>, Non-veg:{' '}
              <strong>{ward.expected_non_veg !== null ? ward.expected_non_veg : 'Unset'}</strong>
            </span>
          </div>

          <span
            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
              ward.food_confirmed
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {ward.food_confirmed ? 'Confirmed' : 'Unconfirmed'}
          </span>
        </div>

        {/* PREVIOUS ARRIVAL BATCHES */}
        {ward.recent_batches && ward.recent_batches.length > 0 && (
          <div className="p-5 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Previous Arrival Batches ({ward.recent_batches.length})</span>
            </h4>

            <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
              {ward.recent_batches.map((batch) => (
                <div key={batch.id} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800">
                      +{batch.batch_size} {batch.batch_size === 1 ? 'person' : 'people'}
                      {batch.excess_acknowledged && (
                        <span className="ml-1.5 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-bold">
                          Excess Ack
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatInKolkataTime(batch.created_at)} • by {batch.recorded_by_name || 'Staff'}
                    </span>
                  </div>

                  {batch.is_voided ? (
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                      Voided: {batch.void_reason || 'Incorrect'}
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-semibold text-[11px]">Recorded</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ARRIVAL ENTRY FORM */}
        <div className="p-5 bg-white">
          <label htmlFor="arrivingInput" className="block text-sm font-bold text-slate-900 mb-1">
            People Arriving Now
          </label>
          <p className="text-xs text-slate-500 mb-3">
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
                className="w-full text-center text-xl font-bold py-2.5 border-2 border-slate-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* Quick Increment Buttons */}
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
                  className={`px-3 py-2 text-xs font-bold rounded-lg border transition ${
                    arrivingCount === num
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  +{num}
                </button>
              ))}
            </div>
          </div>

          {/* Submission Error Banner */}
          {submissionError && !showExcessWarning && (
            <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{submissionError}</span>
            </div>
          )}

          {/* Record Arrival Action Button */}
          {!showExcessWarning && (
            <button
              onClick={() => handleRecordArrival(false)}
              disabled={submitting}
              className="mt-4 w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Confirming Database Write...</span>
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  <span>Record {arrivingCount} {arrivingCount === 1 ? 'Arrival' : 'Arrivals'}</span>
                </>
              )}
            </button>
          )}

          {/* EXCESS WARNING DIALOG / BANNER */}
          {showExcessWarning && excessWarningDetails && (
            <div className="mt-4 bg-amber-50 border-2 border-amber-400 rounded-xl p-4 text-amber-950">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-amber-900">
                    Allowance Exceeded Warning
                  </h4>
                  <p className="text-xs sm:text-sm text-amber-800 mt-1 font-medium">
                    This invitation allows 5 people including the principal invitee. This entry will bring attendance to{' '}
                    <span className="font-black underline">{excessWarningDetails.proposedTotal}</span>, exceeding the allowance by{' '}
                    <span className="font-black underline">{excessWarningDetails.excessBy}</span>.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowExcessWarning(false);
                    setSubmissionError(null);
                  }}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm rounded-lg hover:bg-slate-50 transition"
                >
                  Go Back
                </button>

                <button
                  type="button"
                  onClick={() => handleRecordArrival(true)}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Submit Anyway</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card Footer: Back to Scanner */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onScanNext}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Scan Another Ward</span>
          </button>

          <span className="text-[11px] text-slate-400">
            Request ID: {currentRequestIdRef.current.substring(0, 8)}...
          </span>
        </div>
      </div>
    </div>
  );
}

