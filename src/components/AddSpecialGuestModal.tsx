'use client';

import React, { useState } from 'react';
import { X, Sparkles, AlertTriangle, UserPlus, Trash2, RefreshCw } from 'lucide-react';
import { WardWithStats, PartyAffiliation } from '@/types/database';

interface AddSpecialGuestModalProps {
  onClose: () => void;
  onCreated: (newWard: WardWithStats) => void;
}

export function AddSpecialGuestModal({ onClose, onCreated }: AddSpecialGuestModalProps) {
  const [candidateName, setCandidateName] = useState<string>('');
  const [party, setParty] = useState<PartyAffiliation>('VIP');
  const [allowance, setAllowance] = useState<number>(5);
  const [phone, setPhone] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<string>('');

  // Food Planning State
  const [expectedVeg, setExpectedVeg] = useState<string>('');
  const [expectedNonVeg, setExpectedNonVeg] = useState<string>('');
  const [foodConfirmed, setFoodConfirmed] = useState<boolean>(false);

  // Dynamic Accompanying Guests
  const [guests, setGuests] = useState<Array<{ guest_name: string }>>([
    { guest_name: '' },
  ]);

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedVeg = expectedVeg.trim() === '' ? null : parseInt(expectedVeg, 10);
  const parsedNonVeg = expectedNonVeg.trim() === '' ? null : parseInt(expectedNonVeg, 10);
  const totalFood = (parsedVeg || 0) + (parsedNonVeg || 0);
  const hasFoodInput = parsedVeg !== null || parsedNonVeg !== null;
  const isFoodMismatch = hasFoodInput && totalFood !== allowance;

  const handleGuestChange = (index: number, name: string) => {
    setGuests((prev) =>
      prev.map((g, i) => (i === index ? { guest_name: name } : g))
    );
  };

  const addGuestRow = () => {
    setGuests((prev) => [...prev, { guest_name: '' }]);
  };

  const removeGuestRow = (index: number) => {
    setGuests((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!candidateName.trim()) {
      setErrorMsg('Please enter the principal guest / VIP name.');
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

      const res = await fetch('/api/wards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to register special guest.');
      }

      onCreated(data.ward);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating guest pass.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] border border-black/[0.06] overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="bg-white border-b border-black/[0.06] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <span className="text-xs text-neutral-500 font-medium block">
                VIP & Dignitary Registration
              </span>
              <h3 className="text-lg font-semibold text-neutral-900 tracking-tight">
                Add Special Guest / Additional Invitee
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Guest Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Honored Guest Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sri K. Venkateswara Rao"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-sm font-medium text-neutral-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Category / Badge
              </label>
              <select
                value={party}
                onChange={(e) => setParty(e.target.value as PartyAffiliation)}
                className="w-full px-3.5 py-2.5 bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-sm font-medium text-neutral-900 outline-none"
              >
                <option value="VIP">VIP Invitee</option>
                <option value="SPECIAL">Special Guest</option>
                <option value="ALLIANCE">Alliance Guest / Leader</option>
                <option value="GUEST">Other Dignitary</option>
                <option value="TDP">TDP Representative</option>
                <option value="JSP">JSP Representative</option>
                <option value="BJP">BJP Representative</option>
              </select>
            </div>
          </div>

          {/* Phone & Allowance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Phone Number (Optional)
              </label>
              <input
                type="text"
                placeholder="10-digit number e.g. 9848012345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-sm font-mono text-neutral-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Total Allowed Entries
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
                Number of people admitted under this pass.
              </span>
            </div>
          </div>

          {/* Dynamic Accompanying Guests */}
          <div className="p-4 bg-neutral-50/70 rounded-2xl border border-black/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-neutral-700">
                Accompanying Family / Entourage (Optional)
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
              Names help gate staff identify who is arriving.
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
                  placeholder="0"
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
                  placeholder="0"
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
                  <span className="font-semibold">Allowance Notice: </span>
                  <span>
                    Total food count ({totalFood}) differs from pass allowance ({allowance}).
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Admin Notes */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              VIP Protocol / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Designation, seating arrangements, welcome notes..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl text-sm font-normal outline-none transition-all text-neutral-900"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-black/[0.06] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 font-medium text-xs sm:text-sm rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-medium text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-2 active:scale-[0.99]"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />
                  <span>Creating Pass...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Issue VIP Pass</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
