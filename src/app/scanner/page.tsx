'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRScanner } from '@/components/QRScanner';
import { WardEntryCard } from '@/components/WardEntryCard';
import { AdminWardEditModal } from '@/components/AdminWardEditModal';
import { WardWithStats, UserProfile } from '@/types/database';
import { RefreshCw, Lock, Wifi, WifiOff, CloudUpload, CheckCircle2, LogOut } from 'lucide-react';
import {
  initOfflineStorage,
  flushPendingQueue,
  getPendingQueue,
  updateCachedWards,
} from '@/lib/offline/offlineSync';
import { cacheCandidatePhotosInLocalStorage } from '@/lib/candidatePhotos';
import { cacheAllInvitationsLocally } from '@/lib/offline/invitationCache';
import { stopAllCameraStreams } from '@/lib/camera/cameraManager';

export default function ScannerPage() {
  const router = useRouter();
  const [selectedWardNumber, setSelectedWardNumber] = useState<number | null>(null);
  const selectedWardRef = useRef<number | null>(null);
  selectedWardRef.current = selectedWardNumber;

  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const showExitConfirmRef = useRef<boolean>(false);
  showExitConfirmRef.current = showExitConfirm;

  const [editingWard, setEditingWard] = useState<WardWithStats | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Initialize history guard so back button never exits unexpectedly
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!window.history.state?.scannerRoot) {
      window.history.replaceState({ scannerRoot: true }, '', window.location.href);
      window.history.pushState({ scannerActive: true }, '', window.location.href);
    }

    return () => {
      stopAllCameraStreams();
    };
  }, []);

  // When a ward is scanned or open, force stop camera
  useEffect(() => {
    if (selectedWardNumber !== null) {
      stopAllCameraStreams();
    }
  }, [selectedWardNumber]);

  // Initialize offline storage & automatic background sync loop
  useEffect(() => {
    // 1. Immediately initialize offline storage so all divisions are cached
    initOfflineStorage();
    // Pre-cache all candidate photos directly into localStorage for 0ms offline access
    cacheCandidatePhotosInLocalStorage();
    // Pre-cache all 45MB final invitation cards into CacheStorage for instant offline sharing
    cacheAllInvitationsLocally();
    setPendingCount(getPendingQueue().length);
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    // 2. Network listener for online/offline events
    const handleNetworkChange = () => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setIsOnline(online);
      if (online) {
        flushPendingQueue().then((res) => {
          setPendingCount(res.remaining);
        });
      }
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    // 3. Periodic background sync (every 6 seconds)
    const interval = setInterval(() => {
      setPendingCount(getPendingQueue().length);
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        flushPendingQueue().then((res) => {
          setPendingCount(res.remaining);
        });
      }
    }, 6000);

    // 4. Initial background sync of all 76 divisions from server
    fetch('/api/wards')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data?.wards)) {
          updateCachedWards(data.wards);
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      clearInterval(interval);
    };
  }, []);

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

  const handleWardScanned = useCallback((wardNumber: number) => {
    setSelectedWardNumber(wardNumber);
    if (typeof window !== 'undefined') {
      window.history.pushState({ wardNumber, view: 'result' }, '', `/scanner?division=${wardNumber}`);
    }
  }, []);

  const handleScanNext = useCallback(() => {
    setSelectedWardNumber(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState({ scannerActive: true }, '', '/scanner');
    }
  }, []);

  // Listen for reset events from BottomNav or elsewhere
  useEffect(() => {
    const handleReset = () => {
      setSelectedWardNumber(null);
      if (typeof window !== 'undefined') {
        window.history.replaceState({ scannerActive: true }, '', '/scanner');
      }
    };
    window.addEventListener('reset-scanner-view', handleReset);
    return () => window.removeEventListener('reset-scanner-view', handleReset);
  }, []);

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    if (typeof window !== 'undefined') {
      try {
        window.close();
      } catch {}
      // Fallback if browser blocks window.close(): navigate back out of history
      setTimeout(() => {
        try {
          window.history.go(-10);
        } catch {}
      }, 100);
    }
  };

  // Synchronize history navigation (hardware/browser back button & swipe back)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (typeof window === 'undefined') return;

      // 1. If a modal like Candidate Photo Zoom was popped, don't change scanner view
      if (e.state?.candidatePhotoModal) {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const divParam = params.get('division');

      // 2. Case A: User is viewing a scan result (selectedWardRef.current !== null)
      if (selectedWardRef.current !== null) {
        if (!divParam) {
          // Hardware back button pressed on scan result -> return cleanly to scanner camera!
          setSelectedWardNumber(null);
          // Maintain active guard state for subsequent back presses
          window.history.replaceState({ scannerActive: true }, '', '/scanner');
          return;
        } else {
          const num = parseInt(divParam, 10);
          if (num >= 1) {
            setSelectedWardNumber(num);
            return;
          }
        }
      }

      // 3. Case B: User is on the scanner camera (selectedWardRef.current === null)
      // Hardware back button was pressed on the scanner camera!
      // If the exit confirmation is already showing, dismiss it
      if (showExitConfirmRef.current) {
        setShowExitConfirm(false);
        return;
      }

      // Show confirmation dialog: "Would you like to close the application?"
      setShowExitConfirm(true);
      // Re-push active state so history is preserved in the app
      window.history.pushState({ scannerActive: true }, '', '/scanner');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Keyboard Escape listener to dismiss exit confirmation
  useEffect(() => {
    if (!showExitConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowExitConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showExitConfirm]);

  // Check initial URL params for division deep link
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const divParam = params.get('division');
      if (divParam) {
        const num = parseInt(divParam, 10);
        if (num >= 1 && num <= 76) {
          setSelectedWardNumber(num);
        }
      }
    }
  }, []);

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
    <div className="flex-1 py-8 px-4 sm:px-6 flex flex-col items-center justify-start pb-36 sm:pb-12">
      {/* Top Title Banner (Apple Minimalist Style) */}
      <div className="w-full max-w-lg mb-6 text-center">
        {/* Offline Status & Sync Queue Pill */}
        <div className="flex items-center justify-center gap-2 mb-2.5">
          {pendingCount > 0 ? (
            <button
              type="button"
              onClick={() => flushPendingQueue().then((r) => setPendingCount(r.remaining))}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors shadow-xs active:scale-95"
              title="Click to flush queue now"
            >
              <CloudUpload className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
              <span>{pendingCount} offline {pendingCount === 1 ? 'entry' : 'entries'} queued · Tap to sync</span>
            </button>
          ) : isOnline ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Sync · Instant 0ms Scan</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200 shadow-xs">
              <WifiOff className="w-3 h-3 text-neutral-500" />
              <span>Offline Ready · 76 Divisions Cached</span>
            </span>
          )}
        </div>

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

      {/* ========================================================================= */}
      {/* EXIT APPLICATION CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
          onClick={() => setShowExitConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-2xl border border-neutral-200/80 flex flex-col items-center text-center animate-in zoom-in-95 duration-150"
          >
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mb-4 text-neutral-800 shadow-xs">
              <LogOut className="w-7 h-7 text-neutral-700 stroke-[1.8]" />
            </div>

            <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
              Exit Application?
            </h3>

            <p className="text-xs sm:text-sm text-neutral-500 mt-1.5 leading-relaxed max-w-xs">
              Would you like to close the application?
            </p>

            <div className="mt-6 flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-800 text-sm font-semibold transition-all"
              >
                No, Stay
              </button>

              <button
                type="button"
                onClick={handleConfirmExit}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-sm font-semibold transition-all shadow-xs"
              >
                Yes, Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

