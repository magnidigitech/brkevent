'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, Save, RefreshCw, UserPlus, Trash2, Shield, User } from 'lucide-react';
import { WardWithStats, PartyAffiliation } from '@/types/database';
import { WhatsAppButton } from '@/components/WhatsAppButton';

interface AdminWardEditModalProps {
  ward: WardWithStats;
  onClose: () => void;
  onSaved: (updatedWard: WardWithStats) => void;
  onDeleted?: (wardNumber: number) => void;
}

export function AdminWardEditModal({ ward, onClose, onSaved, onDeleted }: AdminWardEditModalProps) {
  const [candidateName, setCandidateName] = useState<string>(ward.candidate_name);
  const [party, setParty] = useState<PartyAffiliation>(ward.party);
  const [allowance, setAllowance] = useState<number>(ward.allowance || 5);
  const [phone, setPhone] = useState<string>(ward.phone || '');
  const [adminNotes, setAdminNotes] = useState<string>(ward.admin_notes || '');

  // Food Planning State (null = unset)
  const [expectedVeg, setExpectedVeg] = useState<string>(
    ward.expected_veg !== null && ward.expected_veg !== undefined ? String(ward.expected_veg) : ''
  );
  const [expectedNonVeg, setExpectedNonVeg] = useState<string>(
    ward.expected_non_veg !== null && ward.expected_non_veg !== undefined ? String(ward.expected_non_veg) : ''
  );
  const [foodConfirmed, setFoodConfirmed] = useState<boolean>(ward.food_confirmed);

  // Dynamic Accompanying Guests
  const initialGuests = (ward.guests && ward.guests.length > 0)
    ? ward.guests.map((g, idx) => ({ guest_number: idx + 1, guest_name: g.guest_name }))
    : [{ guest_number: 1, guest_name: '' }];
  const [guests, setGuests] = useState(initialGuests);

  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute Food Count Mismatch with flexible allowance
  const parsedVeg = expectedVeg.trim() === '' ? null : parseInt(expectedVeg, 10);
  const parsedNonVeg = expectedNonVeg.trim() === '' ? null : parseInt(expectedNonVeg, 10);

  const totalFood = (parsedVeg || 0) + (parsedNonVeg || 0);
  const hasFoodInput = parsedVeg !== null || parsedNonVeg !== null;
  const isFoodMismatch = hasFoodInput && totalFood !== allowance;

  const handleGuestChange = (index: number, name: string) => {
    setGuests((prev) =>
      prev.map((g, i) => (i === index ? { ...g, guest_name: name } : g))
    );
  };

  const addGuestRow = () => {
    setGuests((prev) => [...prev, { guest_number: prev.length + 1, guest_name: '' }]);
  };

  const removeGuestRow = (index: number) => {
    setGuests((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((g, i) => ({ ...g, guest_number: i + 1 }));
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!candidateName.trim()) {
      setErrorMsg('Principal invitee name cannot be blank.');
      return;
    }

    if (allowance < 1) {
      setErrorMsg('Allowance must be at least 1 person.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        candidate_name: candidateName.trim(),
        party,
        allowance: Number(allowance),
        phone: phone.trim() || null,
        admin_notes: adminNotes.trim() || null,
        expected_veg: parsedVeg,
        expected_non_veg: parsedNonVeg,
        food_confirmed: foodConfirmed,
        guests: guests.filter((g) => g.guest_name.trim().length > 0),
      };

      const res = await fetch(`/api/wards/${ward.ward_number}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update details.');
      }

      onSaved(data.ward);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating record.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (ward.ward_number <= 76) return;
    if (!confirm(`Are you sure you want to remove ${ward.candidate_name} (Pass #${ward.ward_number})?`)) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/wards/${ward.ward_number}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete record.');
      }
      if (onDeleted) onDeleted(ward.ward_number);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting guest.';
      setErrorMsg(msg);
    } finally {
      setDeleting(false);
    }
  };

  const isSpecialGuest = ward.ward_number >= 101;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] border border-black/[0.06] overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="bg-white border-b border-black/[0.06] px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-neutral-500 font-medium block">
              {isSpecialGuest ? 'Special Dignitary & VIP Settings' : 'Division Settings & Directory'}
            </span>
            <h3 className="text-lg font-semibold text-neutral-900 tracking-tight">
              Edit {isSpecialGuest ? `Guest Pass #${ward.ward_number}` : `Division ${ward.ward_number}`} Details
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section: Principal Invitee & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Principal Invitee Name *
              </label>
              <input
                type="text"
                required
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-sm font-medium text-neutral-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Category / Affiliation
              </label>
              <select
                value={party}
                onChange={(e) => setParty(e.target.value as PartyAffiliation)}
                className="w-full px-3.5 py-2.5 bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-sm font-medium text-neutral-900 outline-none"
              >
                <optgroup label="Elected Corporators">
                  <option value="TDP">TDP (Telugu Desam Party)</option>
                  <option value="JSP">JSP (Janasena Party)</option>
                  <option value="BJP">BJP (Bharatiya Janata Party)</option>
                </optgroup>
                <optgroup label="Special Guests & VIPs">
                  <option value="VIP">VIP Invitee</option>
                  <option value="SPECIAL">Special Guest</option>
                  <option value="ALLIANCE">Alliance Guest / Leader</option>
                  <option value="GUEST">Other Dignitary</option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* Phone & Allowance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-neutral-600">
                  Phone Number
                </label>
                {phone && phone.trim().length >= 10 && (
                  <WhatsAppButton
                    ward={{
                      ward_number: ward.ward_number,
                      candidate_name: candidateName,
                      party: party,
                      allowance: allowance,
                      phone: phone,
                    }}
                    variant="pill"
                  />
                )}
              </div>
              <input
                type="text"
                placeholder="10-digit number e.g. 9397605656"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-sm font-mono text-neutral-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Pass Allowance (People Allowed)
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={allowance}
                onChange={(e) => setAllowance(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3.5 py-2.5 bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-sm font-semibold text-neutral-900 outline-none"
              />
              <span className="text-[10px] text-neutral-400 mt-1 block">
                Standard cap is 5. Increase for VIP delegations or families.
              </span>
            </div>
          </div>

          {/* Dynamic Accompanying Guests */}
          <div className="p-4 bg-neutral-50/70 rounded-2xl border border-black/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-neutral-700">
                Accompanying Guests ({guests.filter(g => g.guest_name.trim().length > 0).length} of {allowance} allowance)
              </label>
              <button
                type="button"
                onClick={addGuestRow}
                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add Guest</span>
              </button>
            </div>

            <div className="space-y-2">
              {guests.map((g, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-400 w-16 shrink-0">
                    Guest {idx + 1}:
                  </span>
                  <input
                    type="text"
                    placeholder={`Guest ${idx + 1} Name`}
                    value={g.guest_name}
                    onChange={(e) => handleGuestChange(idx, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900"
                  />
                  {guests.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGuestRow(idx)}
                      className="p-1.5 text-neutral-400 hover:text-rose-500 transition-colors"
                      title="Remove guest"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-neutral-400 mt-2">
              Guest names are optional. Gate scanners record arrivals even if names are left blank.
            </p>
          </div>

          {/* Food Planning Counts */}
          <div className="p-4 bg-neutral-50/70 rounded-2xl border border-black/[0.04] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-neutral-800">
                Food Planning Counts
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={foodConfirmed}
                  onChange={(e) => setFoodConfirmed(e.target.checked)}
                  className="rounded text-neutral-900 focus:ring-neutral-900/20 h-4 w-4 border-neutral-300"
                />
                <span>Mark Counts as Confirmed</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                  Expected Veg
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Unset"
                  value={expectedVeg}
                  onChange={(e) => setExpectedVeg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 focus:border-neutral-900 rounded-xl text-sm font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                  Expected Non-Veg
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Unset"
                  value={expectedNonVeg}
                  onChange={(e) => setExpectedNonVeg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 focus:border-neutral-900 rounded-xl text-sm font-medium outline-none"
                />
              </div>
            </div>

            {/* Food Mismatch Flag */}
            {isFoodMismatch && (
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Allowance Mismatch: </span>
                  <span>
                    Total food count ({totalFood}) does not match the {allowance}-person allowance. Values will be saved exactly as specified.
                  </span>
                </div>
              </div>
            )}

            <p className="text-[11px] text-neutral-400">
              Food counts are for catering estimations only.
            </p>
          </div>

          {/* Admin Notes */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Internal Notes
            </label>
            <textarea
              rows={2}
              placeholder="Special seating, VIP protocol, dietary notes..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl text-sm font-normal outline-none transition-all text-neutral-900"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between">
            {isSpecialGuest ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="px-3.5 py-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Removing...' : 'Delete Guest'}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || deleting}
                className="px-4 py-2 border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 font-medium text-xs sm:text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || deleting}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-2 active:scale-[0.99]"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-neutral-300" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
