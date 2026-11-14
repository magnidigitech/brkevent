'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, Save, RefreshCw, UserPlus, Trash2, Phone } from 'lucide-react';
import { WardWithStats, PartyAffiliation } from '@/types/database';
import { WhatsAppButton } from '@/components/WhatsAppButton';

interface AdminWardEditModalProps {
  ward: WardWithStats;
  onClose: () => void;
  onSaved: (updatedWard: WardWithStats) => void;
}

export function AdminWardEditModal({ ward, onClose, onSaved }: AdminWardEditModalProps) {
  const [candidateName, setCandidateName] = useState<string>(ward.candidate_name);
  const [party, setParty] = useState<PartyAffiliation>(ward.party);
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

  // Accompanying Guests (up to 4)
  const initialGuests = [1, 2, 3, 4].map((num) => {
    const existing = ward.guests?.find((g) => g.guest_number === num);
    return { guest_number: num, guest_name: existing?.guest_name || '' };
  });
  const [guests, setGuests] = useState(initialGuests);

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute Food Count Mismatch with 5-person allowance
  const parsedVeg = expectedVeg.trim() === '' ? null : parseInt(expectedVeg, 10);
  const parsedNonVeg = expectedNonVeg.trim() === '' ? null : parseInt(expectedNonVeg, 10);

  const totalFood = (parsedVeg || 0) + (parsedNonVeg || 0);
  const hasFoodInput = parsedVeg !== null || parsedNonVeg !== null;
  const isFoodMismatch = hasFoodInput && totalFood !== ward.allowance;

  const handleGuestChange = (num: number, name: string) => {
    setGuests((prev) =>
      prev.map((g) => (g.guest_number === num ? { ...g, guest_name: name } : g))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!candidateName.trim()) {
      setErrorMsg('Principal invitee candidate name cannot be blank.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        candidate_name: candidateName.trim(),
        party,
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
        throw new Error(data.message || 'Failed to update ward details.');
      }

      onSaved(data.ward);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating ward.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Admin Ward Directory Editor
            </span>
            <h3 className="text-lg font-bold">Edit Ward {ward.ward_number} Details</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section: Principal Invitee & Party */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Principal Invitee Name *
              </label>
              <input
                type="text"
                required
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Party Affiliation
              </label>
              <select
                value={party}
                onChange={(e) => setParty(e.target.value as PartyAffiliation)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              >
                <option value="TDP">TDP (Telugu Desam Party)</option>
                <option value="JSP">JSP (Janasena Party)</option>
                <option value="BJP">BJP (Bharatiya Janata Party)</option>
              </select>
            </div>
          </div>

          {/* Phone & Allowance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Phone Number
                </label>
                {phone && phone.trim().length >= 10 && (
                  <WhatsAppButton
                    ward={{
                      ward_number: ward.ward_number,
                      candidate_name: candidateName,
                      party: party,
                      allowance: ward.allowance,
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
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Allowance
              </label>
              <input
                type="text"
                disabled
                value="5 people TOTAL"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-600 font-bold"
              />
            </div>
          </div>

          {/* Accompanying Guests (up to 4) */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Accompanying Guests (Optional, up to 4 guests)
            </label>
            <div className="space-y-2">
              {guests.map((g) => (
                <div key={g.guest_number} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 w-16">
                    Guest {g.guest_number}:
                  </span>
                  <input
                    type="text"
                    placeholder={`Guest ${g.guest_number} Name (optional)`}
                    value={g.guest_name}
                    onChange={(e) => handleGuestChange(g.guest_number, e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {g.guest_name && (
                    <button
                      type="button"
                      onClick={() => handleGuestChange(g.guest_number, '')}
                      className="p-1.5 text-slate-400 hover:text-rose-500"
                      title="Clear guest"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Guest names are optional. Staff can record arrivals regardless of whether guest names are entered.
            </p>
          </div>

          {/* Food Planning Counts */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Food Planning Counts
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={foodConfirmed}
                  onChange={(e) => setFoodConfirmed(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <span>Mark Counts as Confirmed</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Expected Veg
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Unset"
                  value={expectedVeg}
                  onChange={(e) => setExpectedVeg(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Expected Non-Veg
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Unset"
                  value={expectedNonVeg}
                  onChange={(e) => setExpectedNonVeg(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Food Mismatch Flag */}
            {isFoodMismatch && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Allowance Mismatch: </span>
                  <span>
                    Total food count ({totalFood}) does not match the 5-person allowance. Values will be saved exactly as specified without silent changes.
                  </span>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500">
              Food counts are for catering planning only and do not affect actual arrival counts.
            </p>
          </div>

          {/* Admin Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Admin Notes (Internal)
            </label>
            <textarea
              rows={2}
              placeholder="Special instructions, seating, or contact notes..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow transition flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
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
        </form>
      </div>
    </div>
  );
}

