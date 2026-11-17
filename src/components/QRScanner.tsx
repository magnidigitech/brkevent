'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Camera, CameraOff, AlertCircle, RefreshCw, Search, X, ChevronRight } from 'lucide-react';
import { parseWardQRCode } from '@/lib/qr/parser';
import { WARDS_SEED_DATA, WardSeed } from '@/data/wardsSeed';
import { WardWithStats } from '@/types/database';
import { PartyBadge } from '@/components/PartyBadge';
import {
  initOfflineStorage,
  updateCachedWards,
  getCachedCanvaResolution,
  cacheCanvaResolution,
} from '@/lib/offline/offlineSync';
import { stopAllCameraStreams } from '@/lib/camera/cameraManager';

interface QRScannerProps {
  onWardScanned: (wardNumber: number) => void;
  isPaused: boolean;
}

export function QRScanner({ onWardScanned, isPaused }: QRScannerProps) {
  const [scannerActive, setScannerActive] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedUrlError, setScannedUrlError] = useState<string | null>(null);
  const [manualSearchQuery, setManualSearchQuery] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [wards, setWards] = useState<Array<WardWithStats | WardSeed>>(WARDS_SEED_DATA);

  // Sync latest live ward details (candidate names, updated phones)
  useEffect(() => {
    // 1. Immediately initialize all 76 divisions from local cache (0ms)
    const offlineWards = initOfflineStorage();
    if (offlineWards && offlineWards.size > 0) {
      setWards(Array.from(offlineWards.values()));
    }

    // 2. Refresh from server in background without blocking
    fetch('/api/wards')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data?.wards) && data.wards.length > 0) {
          setWards(data.wards);
          updateCachedWards(data.wards);
        }
      })
      .catch(() => {});
  }, []);

  // References to handle Html5Qrcode lifecycle and prevent concurrent state transitions
  const scannerRef = useRef<any>(null);
  const isTransitioningRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const qrRegionId = 'qr-reader-container';

  // Stop scanner safely and release hardware
  const stopScanner = useCallback(async () => {
    // Force stop all camera hardware tracks first
    stopAllCameraStreams();

    if (!scannerRef.current) {
      isTransitioningRef.current = false;
      return;
    }

    try {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner.isScanning) {
        await scanner.stop();
      }
      try {
        await scanner.clear();
      } catch {}
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already under transition') && !msg.includes('not running') && !msg.includes('media was removed')) {
        console.warn('Handled stopScanner warning:', err);
      }
    } finally {
      stopAllCameraStreams();
      isTransitioningRef.current = false;
    }
  }, []);

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    const parseResult = parseWardQRCode(decodedText, typeof window !== 'undefined' ? window.location.host : undefined);

    if (!parseResult.valid) {
      setScannedUrlError(parseResult.error || 'Invalid QR code. Please scan an official division invitation.');
      return;
    }

    setScannedUrlError(null);

    // If dynamic redirect QR (e.g. Canva QR)
    if (parseResult.isDynamicRedirect) {
      // 1. Instant cache check (0ms)
      const cachedWardNumber = getCachedCanvaResolution(decodedText);
      if (cachedWardNumber) {
        onWardScanned(cachedWardNumber);
        return;
      }

      try {
        setIsInitializing(true);
        const res = await fetch(`/api/qr/resolve?url=${encodeURIComponent(decodedText)}`);
        const data = await res.json();
        if (data.valid && data.wardNumber) {
          cacheCanvaResolution(decodedText, data.wardNumber);
          onWardScanned(data.wardNumber);
        } else {
          setScannedUrlError(data.message || 'Could not resolve Canva QR destination.');
        }
      } catch (err) {
        setScannedUrlError('Failed to resolve dynamic Canva QR code.');
      } finally {
        setIsInitializing(false);
      }
      return;
    }

    if (parseResult.wardNumber) {
      onWardScanned(parseResult.wardNumber);
    }
  }, [onWardScanned]);

  // Start scanner safely with transition protection
  const startScanner = useCallback(async () => {
    if (!isMountedRef.current || isPaused) return;

    setCameraError(null);
    setScannedUrlError(null);
    setIsInitializing(true);
    isTransitioningRef.current = true;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (!isMountedRef.current || isPaused) {
        stopAllCameraStreams();
        return;
      }

      // Verify DOM element exists
      const containerEl = document.getElementById(qrRegionId);
      if (!containerEl) {
        isTransitioningRef.current = false;
        setIsInitializing(false);
        return;
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(qrRegionId);
      }

      // If already scanning, stop first
      if (scannerRef.current.isScanning) {
        try {
          await scannerRef.current.stop();
        } catch {}
      }

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      // Start camera with rear camera preference
      await scannerRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText: string) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Ignore periodic frame scan misses
        }
      );

      // CRITICAL CHECK: If component unmounted while camera stream was starting up, shut down immediately
      if (!isMountedRef.current || isPaused) {
        stopAllCameraStreams();
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
          } catch {}
          try {
            await scannerRef.current.clear();
          } catch {}
          scannerRef.current = null;
        }
        return;
      }

      if (isMountedRef.current) {
        setScannerActive(true);
      }
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      const msg = errObj.message || '';

      // Gracefully ignore AbortError when media element is removed during transition/unmount
      if (
        errObj.name === 'AbortError' ||
        msg.includes('media was removed') ||
        msg.includes('already under transition')
      ) {
        stopAllCameraStreams();
        return;
      }

      console.warn('Handled camera start issue:', err);
      let errMsg = 'Could not access the camera. Please check camera permissions in your browser settings.';
      if (errObj.name === 'NotAllowedError' || msg.includes('Permission') || msg.includes('denied')) {
        errMsg = 'Camera permission was denied. Please allow camera access in your browser to scan invitations.';
      } else if (errObj.name === 'NotFoundError' || msg.includes('not found')) {
        errMsg = 'No camera detected on this device. Please use manual division search below.';
      }

      if (isMountedRef.current) {
        setCameraError(errMsg);
        setScannerActive(false);
      }
    } finally {
      isTransitioningRef.current = false;
      if (isMountedRef.current) {
        setIsInitializing(false);
      }
    }
  }, [handleScanSuccess, isPaused]);

  // Synchronize scanner lifecycle with paused state and active toggle
  useEffect(() => {
    isMountedRef.current = true;

    if (isPaused) {
      stopAllCameraStreams();
      stopScanner();
    } else if (scannerActive) {
      // Small timeout allows DOM to fully settle before requesting video stream
      const timer = setTimeout(() => {
        if (isMountedRef.current && !isPaused) {
          startScanner();
        }
      }, 100);
      return () => {
        clearTimeout(timer);
        stopAllCameraStreams();
      };
    }

    return () => {
      isMountedRef.current = false;
      stopAllCameraStreams();
      stopScanner();
    };
  }, [isPaused, scannerActive, startScanner, stopScanner]);

  const toggleScanner = async () => {
    if (scannerActive) {
      await stopScanner();
      setScannerActive(false);
    } else {
      setScannerActive(true);
    }
  };

  const handleManualSelect = (wardNumber: number) => {
    setScannedUrlError(null);
    onWardScanned(wardNumber);
  };

  // Live AJAX search filtering for manual lookup with smart numeric prioritization
  const cleanQuery = manualSearchQuery.toLowerCase().trim();
  const searchResults = useMemo(() => {
    if (!cleanQuery) return [];

    const isPureDigits = /^\d+$/.test(cleanQuery);
    const queryDigits = cleanQuery.replace(/\D/g, '');
    const digitCount = queryDigits.length;

    // Rule: For 1 or 2 digits, search strictly by Division number (do NOT match random 2-digit pairs in phone numbers).
    // If more than 2 digits (3+ digits, e.g. "98851", "4343"), check against phone numbers.
    const allowPhoneSearch = digitCount > 2;

    // Check if query is like "division 45", "div 45", "d45", "w45", "ward 45" or pure digits like "1", "45"
    const wardPrefixMatch = cleanQuery.match(/^(?:w|ward|d|div|division)[ -]?(\d{1,2})$/i);
    const targetWardNum = isPureDigits
      ? parseInt(cleanQuery, 10)
      : wardPrefixMatch
      ? parseInt(wardPrefixMatch[1], 10)
      : null;

    const matches = wards.filter((w) => {
      if (!w) return false;

      // 1. Division / Ward Number Matches
      let matchDivision = false;
      if (targetWardNum !== null) {
        // Single and double digit numbers match EXACT division only (e.g. "1" matches Division 1 only, never 10, 11, etc.)
        matchDivision = w.ward_number === targetWardNum;
      } else if (!isPureDigits && cleanQuery.length > 2) {
        matchDivision =
          `division ${w.ward_number}` === cleanQuery ||
          `ward ${w.ward_number}` === cleanQuery;
      }

      // 2. Candidate Name Matches (only when query is not pure digits)
      const matchName = !isPureDigits && w.candidate_name ? w.candidate_name.toLowerCase().includes(cleanQuery) : false;

      // 3. Party Matches (only when query is not pure digits)
      const matchParty = !isPureDigits && w.party ? w.party.toLowerCase().includes(cleanQuery) : false;

      // 4. Phone Number Matches (strictly allowed ONLY if more than 2 digits)
      const cleanPhone = w.phone ? w.phone.replace(/\D/g, '') : '';
      const matchPhone = allowPhoneSearch && cleanPhone.includes(queryDigits);

      return matchDivision || matchName || matchParty || matchPhone;
    });

    // Priority Ranking:
    // Rank 1: Exact division number match ALWAYS first
    // Rank 2: Ascending division order
    return matches
      .sort((a, b) => {
        const aExact = targetWardNum !== null && a.ward_number === targetWardNum;
        const bExact = targetWardNum !== null && b.ward_number === targetWardNum;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        return a.ward_number - b.ward_number;
      })
      .slice(0, 10);
  }, [cleanQuery, wards]);

  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-4">
      {/* Scanner Card (Apple Minimalist Aesthetic) */}
      <div className="w-full bg-white rounded-3xl border border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Scanner Viewport Header */}
        <div className="bg-white px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between border-b border-black/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-neutral-900 leading-tight">Live Camera Scanner</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${scannerActive ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}`} />
                <span className="text-[11px] text-neutral-400 font-normal">
                  {scannerActive ? 'Auto-detecting invitation QR' : 'Camera is paused'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={toggleScanner}
            disabled={isInitializing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 disabled:opacity-50 ${
              scannerActive
                ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900'
                : 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs'
            }`}
          >
            {scannerActive ? (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>Resume</span>
              </>
            )}
          </button>
        </div>

        {/* Camera Box */}
        <div className="relative bg-neutral-950 min-h-[280px] sm:min-h-[320px] flex items-center justify-center overflow-hidden">
          {/* HTML5 QR Container */}
          <div
            id={qrRegionId}
            className={`w-full max-w-[320px] aspect-square transition-opacity duration-300 ${
              scannerActive && !cameraError ? 'opacity-100' : 'opacity-0 h-0 hidden'
            }`}
          />

          {/* Loading State */}
          {isInitializing && (
            <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 z-10">
              <RefreshCw className="w-7 h-7 text-white/80 animate-spin" />
              <span className="text-xs font-medium text-white/90">Starting camera...</span>
            </div>
          )}

          {/* Stopped State */}
          {!scannerActive && !cameraError && (
            <div className="p-8 text-center text-neutral-400 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white/80">
                <CameraOff className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-white/90">Camera scanner is paused</p>
              <button
                onClick={toggleScanner}
                className="px-4 py-2 bg-white text-neutral-900 rounded-xl text-xs font-semibold shadow-md hover:bg-neutral-100 active:scale-95 transition-all"
              >
                Turn On Camera
              </button>
            </div>
          )}

          {/* Camera Permission / Error Message */}
          {cameraError && (
            <div className="p-6 text-center text-neutral-300 flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs text-rose-200 max-w-xs">{cameraError}</p>
              <button
                onClick={startScanner}
                className="flex items-center gap-2 px-4 py-2 bg-white/15 text-white rounded-xl text-xs font-medium hover:bg-white/25 active:scale-95 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Camera Permission</span>
              </button>
            </div>
          )}
        </div>

        {/* Scanned QR Validation Error Banner */}
        {scannedUrlError && (
          <div className="bg-rose-50/90 border-t border-rose-200/60 p-3.5 flex items-start gap-3 text-rose-900">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-rose-900">Invalid QR Code</p>
              <p className="text-rose-700 mt-0.5">{scannedUrlError}</p>
            </div>
          </div>
        )}

        {/* Scanner Footnote */}
        <div className="p-2.5 bg-white border-t border-black/[0.06] text-center">
          <p className="text-[11px] text-neutral-400 font-normal">
            Center invitation QR code in frame to scan automatically
          </p>
        </div>
      </div>

      {/* Simple AJAX Search Bar (Instant Live Typing) */}
      <div className="w-full bg-white rounded-3xl border border-black/[0.06] shadow-[0_2px_16px_rgba(0,0,0,0.03)] p-3 sm:p-4 transition-all">
        {/* Simple Search Input Box */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search division # (1–76), corporator, party..."
            value={manualSearchQuery}
            onChange={(e) => setManualSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 text-sm bg-neutral-100 hover:bg-neutral-100/80 focus:bg-white text-neutral-900 placeholder:text-neutral-400 rounded-2xl border border-transparent focus:border-black/[0.1] focus:ring-2 focus:ring-neutral-900/10 focus:outline-none transition-all"
          />
          {manualSearchQuery && (
            <button
              type="button"
              onClick={() => setManualSearchQuery('')}
              className="w-5 h-5 rounded-full bg-neutral-200 hover:bg-neutral-300 text-neutral-600 flex items-center justify-center absolute right-3 transition"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Live AJAX Search Results List */}
        {cleanQuery ? (
          <div className="mt-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            {searchResults.length > 0 ? (
              <>
                <div className="px-1 py-1 flex items-center justify-between text-[11px] font-medium text-neutral-400">
                  <span>Matching Divisions</span>
                  <span>
                    {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
                  </span>
                </div>
                {searchResults.map((w) => (
                  <div
                    key={w.ward_number}
                    onClick={() => {
                      setManualSearchQuery('');
                      handleManualSelect(w.ward_number);
                    }}
                    className="p-3 bg-neutral-50/70 hover:bg-neutral-100 active:bg-neutral-200/70 border border-black/[0.04] rounded-2xl flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-neutral-900 text-white font-semibold text-xs sm:text-sm flex items-center justify-center shrink-0">
                        {w.ward_number}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-semibold text-neutral-900 truncate group-hover:text-black">
                          {w.candidate_name}
                        </span>
                        <span className="text-[11px] text-neutral-500 truncate mt-0.5">
                          Division {w.ward_number} • {w.phone || 'No phone'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <PartyBadge party={w.party} size="sm" />
                      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="py-6 text-center text-neutral-400">
                <p className="text-xs font-medium text-neutral-700">No divisions match &ldquo;{manualSearchQuery}&rdquo;</p>
                <p className="text-[11px] text-neutral-400 mt-1">Try division number (1–76), corporator name, or party</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
