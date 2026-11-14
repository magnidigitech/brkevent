'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WardEntryCard } from '@/components/WardEntryCard';
import { AdminWardEditModal } from '@/components/AdminWardEditModal';
import { WardWithStats } from '@/types/database';

interface WardClientViewProps {
  wardNumber: number;
  wardSlug: string;
  isAdmin: boolean;
}

export function WardClientView({ wardNumber, isAdmin }: WardClientViewProps) {
  const router = useRouter();
  const [editingWard, setEditingWard] = useState<WardWithStats | null>(null);

  const handleScanNext = () => {
    router.push('/scanner');
  };

  const handleOpenEdit = async () => {
    try {
      const res = await fetch(`/api/wards/${wardNumber}`);
      const data = await res.json();
      if (data?.success && data?.ward) {
        setEditingWard(data.ward);
      }
    } catch (err) {
      console.error('Failed to fetch ward for edit:', err);
    }
  };

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 flex flex-col items-center justify-start">
      <div className="w-full max-w-lg mb-4 text-center">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Ward {wardNumber} Invitation
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
          Verified invitation QR code from event.bhashyamramakrishna.in
        </p>
      </div>

      <WardEntryCard
        wardNumber={wardNumber}
        onScanNext={handleScanNext}
        isAdmin={isAdmin}
        onEditWard={handleOpenEdit}
      />

      {editingWard && (
        <AdminWardEditModal
          ward={editingWard}
          onClose={() => setEditingWard(null)}
          onSaved={() => {
            setEditingWard(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
