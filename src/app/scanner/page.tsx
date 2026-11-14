'use client';

import React, { useState, useEffect } from 'react';
import { QRScanner } from '@/components/QRScanner';
import { WardEntryCard } from '@/components/WardEntryCard';
import { AdminWardEditModal } from '@/components/AdminWardEditModal';
import { WardWithStats, UserProfile } from '@/types/database';

export default function ScannerPage() {
  const [selectedWardNumber, setSelectedWardNumber] = useState<number | null>(null);
  const [editingWard, setEditingWard] = useState<WardWithStats | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch('/api/auth/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.profile) {
          setUserProfile(data.profile);
        }
      })
      .catch(() => {});
  }, []);

  const handleWardScanned = (wardNumber: number) => {
    setSelectedWardNumber(wardNumber);
  };

  const handleScanNext = () => {
    setSelectedWardNumber(null);
  };

  const handleOpenEdit = async () => {
    if (!selectedWardNumber) return;
    try {
      const res = await fetch(`/api/wards/${selectedWardNumber}`);
      const data = await res.json();
      if (data?.success && data?.ward) {
        setEditingWard(data.ward);
      }
    } catch (err) {
      console.error('Failed to fetch ward for edit:', err);
    }
  };

  const isAdmin = userProfile?.role === 'admin';

  return (
    <div className="flex-1 py-6 px-4 sm:px-6 flex flex-col items-center justify-start">
      {/* Top Title Banner */}
      <div className="w-full max-w-lg mb-4 text-center">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Gate Attendance Scanner
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
          Scan printed ward invitations (Wards 1–76). 5 people allowance per ward.
        </p>
      </div>

      {/* Conditionally show Ward Entry Card or Camera Scanner */}
      {selectedWardNumber ? (
        <WardEntryCard
          wardNumber={selectedWardNumber}
          onScanNext={handleScanNext}
          isAdmin={isAdmin}
          onEditWard={handleOpenEdit}
        />
      ) : (
        <QRScanner
          onWardScanned={handleWardScanned}
          isPaused={selectedWardNumber !== null}
        />
      )}

      {/* Admin Edit Modal if opened */}
      {editingWard && (
        <AdminWardEditModal
          ward={editingWard}
          onClose={() => setEditingWard(null)}
          onSaved={() => {
            // Trigger refresh
            setEditingWard(null);
          }}
        />
      )}
    </div>
  );
}
