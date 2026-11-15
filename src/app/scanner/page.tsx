'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRScanner } from '@/components/QRScanner';
import { WardEntryCard } from '@/components/WardEntryCard';
import { AdminWardEditModal } from '@/components/AdminWardEditModal';
import { WardWithStats, UserProfile } from '@/types/database';
import { RefreshCw, Lock } from 'lucide-react';

export default function ScannerPage() {
  const router = useRouter();
  const [selectedWardNumber, setSelectedWardNumber] = useState<number | null>(null);
  const [editingWard, setEditingWard] = useState<WardWithStats | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/auth/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.profile) {
          setUserProfile(data.profile);
        } else {
          setUserProfile(null);
        }
      })
      .catch(() => {
        setUserProfile(null);
      })
      .finally(() => {
        setCheckingAuth(false);
      });
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

  // If verifying authentication, show clean minimal loader
  if (checkingAuth) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[50vh]">
        <div className="w-12 h-12 rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-black/[0.06] flex items-center justify-center mb-3">
          <RefreshCw className="w-5 h-5 text-neutral-800 animate-spin" />
        </div>
        <span className="text-xs font-medium text-neutral-500 tracking-tight">
          Verifying staff session...
        </span>
      </div>
    );
  }

  // If not logged in, prompt or wait for redirect
  if (!userProfile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[50vh]">
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3 text-neutral-700">
          <Lock className="w-5 h-5" />
        </div>
        <span className="text-sm font-semibold text-neutral-900 tracking-tight">
          Staff Authentication Required
        </span>
        <p className="text-xs text-neutral-500 mt-1 mb-4 text-center">
          Please sign in to access the invitation scanner.
        </p>
        <Link
          href="/login"
          className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 active:scale-95 transition-all"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 flex flex-col items-center justify-start">
      {/* Top Title Banner (Apple Minimalist Style) */}
      <div className="w-full max-w-lg mb-6 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
          Gate Attendance Scanner
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1 font-normal">
          Scan printed division invitations (Divisions 1–76). 5 people allowance per division.
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

