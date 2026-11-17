'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Camera, CameraOff, AlertCircle, RefreshCw, Search, X, ChevronRight, ArrowLeft, Users, Sparkles } from 'lucide-react';
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
  const [isSearchFullscreen, setIsSearchFullscreen] = useState<boolean>(false);
  const [searchCategory, setSearchCategory] = useState<'ALL' | 'CORPORATORS' | 'VIP' | 'TDP' | 'JSP' | 'BJP'>('ALL');
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [wards, setWards] = useState<Array<WardWithStats | WardSeed>>(WARDS_SEED_DATA);
  const fullscreenInputRef = useRef<HTMLInputElement>(null);

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
  const isStartingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const hasAutoRetriedRef = useRef<boolean>(false);
  const onWardScannedRef = useRef(onWardScanned);
  onWardScannedRef.current = onWardScanned;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const isSearchFullscreenRef = useRef(isSearchFullscreen);
  isSearchFullscreenRef.current = isSearchFullscreen;
  const qrRegionId = 'qr-reader-container';

  // Stop scanner safely and release hardware
  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (err) {
        // ignore
      }
      try {
        await scanner.clear();
      } catch (err) {
        // ignore
      }
    }

    stopAllCameraStreams();
    isTransitioningRef.current = false;
    isStartingRef.current = false;
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
        onWardScannedRef.current(cachedWardNumber);
        return;
      }

      try {
        setIsInitializing(true);
        const res = await fetch(`/api/qr/resolve?url=${encodeURIComponent(decodedText)}`);
        const data = await res.json();
        if (data.valid && data.wardNumber) {
          cacheCanvaResolution(decodedText, data.wardNumber);
          onWardScannedRef.current(data.wardNumber);
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
      onWardScannedRef.current(parseResult.wardNumber);
    }
  }, []);

  const handleScanSuccessRef = useRef(handleScanSuccess);
  handleScanSuccessRef.current = handleScanSuccess;

  // Start scanner safely with transition protection and concurrency lock
  const startScanner = useCallback(async () => {
    if (!isMountedRef.current || isPausedRef.current || isSearchFullscreenRef.current) return;
    if (isStartingRef.current) return;

    // If scanner is already scanning, maintain active
    if (scannerRef.current?.isScanning) {
      setScannerActive(true);
      return;
    }

    isStartingRef.current = true;
    setCameraError(null);
    setScannedUrlError(null);
    setIsInitializing(true);
    isTransitioningRef.current = true;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (!isMountedRef.current || isPausedRef.current || isSearchFullscreenRef.current) {
        return;
      }

      // Verify DOM element exists
      const containerEl = document.getElementById(qrRegionId);
      if (!containerEl) {
        return;
      }

      // Clean up previous instance and container DOM before creating new instance
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch {}
        scannerRef.current = null;
      }
      containerEl.innerHTML = '';

      const html5Qr = new Html5Qrcode(qrRegionId);
      scannerRef.current = html5Qr;

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      // Select camera device intelligently:
      // On mobile devices, prefer the rear/back camera.
      // On desktops/laptops with only a front webcam (e.g. MacBook), select that camera cleanly.
      let cameraParam: any = { facingMode: 'environment' };

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const backCam = cameras.find((c) =>
            /back|rear|environment/i.test(c.label)
          );
          if (backCam) {
            cameraParam = backCam.id;
          } else {
            cameraParam = cameras[0].id;
          }
        }
      } catch (camListErr) {
        cameraParam = { facingMode: 'environment' };
      }

      // Try starting with preferred camera; if environment mode is unsupported (e.g. laptop), fall back to user camera
      try {
        await html5Qr.start(
          cameraParam,
          config,
          (decodedText: string) => {
            handleScanSuccessRef.current(decodedText);
          },
          () => {
            // Ignore periodic frame scan misses
          }
        );
      } catch (firstStartErr) {
        console.warn('Initial camera start failed, attempting user-facing camera fallback:', firstStartErr);
        await html5Qr.start(
          { facingMode: 'user' },
          config,
          (decodedText: string) => {
            handleScanSuccessRef.current(decodedText);
          },
          () => {}
        );
      }

      // If component unmounted while camera stream was starting up, shut down immediately
      if (!isMountedRef.current || isPausedRef.current || isSearchFullscreenRef.current) {
        if (scannerRef.current?.isScanning) {
          try {
            await scannerRef.current.stop();
          } catch {}
        }
        stopAllCameraStreams();
        return;
      }

      setScannerActive(true);
      setCameraError(null);
      hasAutoRetriedRef.current = false;
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      const msg = errObj.message || '';

      // Gracefully ignore AbortError when media element is removed during transition/unmount
      if (
        errObj.name === 'AbortError' ||
        msg.includes('media was removed') ||
        msg.includes('already under transition')
      ) {
        return;
      }

      // If camera hardware was temporarily locked or releasing from prior view, retry once automatically after 300ms
      if (
        (errObj.name === 'NotReadableError' || msg.includes('video source') || msg.includes('Device in use')) &&
        !hasAutoRetriedRef.current &&
        isMountedRef.current &&
        !isPausedRef.current
      ) {
        hasAutoRetriedRef.current = true;
        console.info('Camera busy, automatically retrying in 300ms...');
        setTimeout(() => {
          if (isMountedRef.current && !isPausedRef.current) {
            startScanner();
          }
        }, 300);
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
      isStartingRef.current = false;
      isTransitioningRef.current = false;
      if (isMountedRef.current) {
        setIsInitializing(false);
      }
    }
  }, []);

  // Manage camera lifecycle and auto-stop on pause or full-screen search
  useEffect(() => {
    isMountedRef.current = true;
    const effectivelyPaused = isPaused || isSearchFullscreen;

    if (effectivelyPaused) {
      stopScanner();
    } else if (scannerActive) {
      // Small timeout allows DOM to fully settle before requesting video stream
      const timer = setTimeout(() => {
        if (isMountedRef.current && !isPaused && !isSearchFullscreen) {
          startScanner();
        }
      }, 150);
      return () => {
        clearTimeout(timer);
      };
    }

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [isPaused, isSearchFullscreen, scannerActive, startScanner, stopScanner]);

  const toggleScanner = async () => {
    if (scannerActive) {
      await stopScanner();
      setScannerActive(false);
    } else {
      setCameraError(null);
      setScannerActive(true);
      await startScanner();
    }
  };

  const handleManualSelect = (wardNumber: number) => {
    setScannedUrlError(null);
    setIsSearchFullscreen(false);
    onWardScanned(wardNumber);
  };

  // Helper to filter by category
  const passesCategory = (w: WardWithStats | WardSeed, cat: string) => {
    if (cat === 'ALL') return true;
    if (cat === 'CORPORATORS') return w.ward_number <= 76;
    if (cat === 'VIP') return w.ward_number >= 101 || ['VIP', 'SPECIAL', 'GUEST', 'ALLIANCE'].includes(w.party);
    if (cat === 'TDP') return w.party === 'TDP';
    if (cat === 'JSP') return w.party === 'JSP';
    if (cat === 'BJP') return w.party === 'BJP';
    return true;
  };

  // Live AJAX search filtering for manual lookup with smart numeric prioritization
  const cleanQuery = manualSearchQuery.toLowerCase().trim();
  const searchResults = useMemo(() => {
    const isPureDigits = /^\d+$/.test(cleanQuery);
    const queryDigits = cleanQuery.replace(/\D/g, '');
    const digitCount = queryDigits.length;
    const allowPhoneSearch = digitCount > 2;

    const wardPrefixMatch = cleanQuery.match(/^(?:w|ward|d|div|division|pass|p|vip)[ -]?(\d{1,4})$/i);
    const targetWardNum = isPureDigits
      ? parseInt(cleanQuery, 10)
      : wardPrefixMatch
      ? parseInt(wardPrefixMatch[1], 10)
      : null;

    let baseList = wards;
    if (searchCategory !== 'ALL') {
      baseList = baseList.filter((w) => passesCategory(w, searchCategory));
    }

    if (!cleanQuery) {
      return [...baseList].sort((a, b) => a.ward_number - b.ward_number);
    }

    const matches = baseList.filter((w) => {
      if (!w) return false;

      // 1. Division / Pass Number Matches
      let matchDivision = false;
      if (targetWardNum !== null) {
        matchDivision = w.ward_number === targetWardNum;
      } else if (!isPureDigits && cleanQuery.length >= 2) {
        matchDivision =
          `division ${w.ward_number}`.includes(cleanQuery) ||
          `ward ${w.ward_number}`.includes(cleanQuery) ||
          `pass ${w.ward_number}`.includes(cleanQuery) ||
          `pass #${w.ward_number}`.includes(cleanQuery);
      }

      // 2. Candidate / Guest Name Matches
      const matchName = !isPureDigits && w.candidate_name ? w.candidate_name.toLowerCase().includes(cleanQuery) : false;

      // 3. Party Matches
      const matchParty = !isPureDigits && w.party ? w.party.toLowerCase().includes(cleanQuery) : false;

      // 4. Phone Number Matches
      const cleanPhone = w.phone ? w.phone.replace(/\D/g, '') : '';
      const matchPhone = allowPhoneSearch && cleanPhone.includes(queryDigits);

      return matchDivision || matchName || matchParty || matchPhone;
    });

    return matches.sort((a, b) => {
      const aExact = targetWardNum !== null && a.ward_number === targetWardNum;
      const bExact = targetWardNum !== null && b.ward_number === targetWardNum;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      return a.ward_number - b.ward_number;
    });
  }, [cleanQuery, wards, searchCategory]);

  useEffect(() => {
    if (isSearchFullscreen) {
      const timer = setTimeout(() => {
        fullscreenInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchFullscreen]);

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
                onClick={() => {
                  setCameraError(null);
                  setScannerActive(true);
                  startScanner();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white/15 text-white rounded-xl text-xs font-medium hover:bg-white/25 active:scale-95 transition cursor-pointer"
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

      {/* Simple AJAX Search Bar (Tap/Focus for Fullscreen Mobile Search) */}
      <div className="w-full bg-white rounded-3xl border border-black/[0.06] shadow-[0_2px_16px_rgba(0,0,0,0.03)] p-3 sm:p-4 transition-all">
        {/* Simple Search Input Box (Triggers Fullscreen on Focus) */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            readOnly
            onClick={() => setIsSearchFullscreen(true)}
            onFocus={() => setIsSearchFullscreen(true)}
            placeholder="Search division # (1–76), corporator, pass, or phone..."
            value={manualSearchQuery}
            className="w-full pl-10 pr-9 py-2.5 text-sm bg-neutral-100 hover:bg-neutral-100/80 focus:bg-white text-neutral-900 placeholder:text-neutral-400 rounded-2xl border border-transparent focus:border-black/[0.1] focus:ring-2 focus:ring-neutral-900/10 focus:outline-none transition-all cursor-pointer"
          />
          <button
            type="button"
            onClick={() => setIsSearchFullscreen(true)}
            className="px-2.5 py-1 text-[11px] font-semibold bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg absolute right-2.5 transition"
          >
            Search
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FULL-SCREEN SEARCH MODAL ON FOCUS */}
      {/* ========================================================================= */}
      {isSearchFullscreen && (
        <div className="fixed inset-0 z-[100] bg-[#fbfbfd] flex flex-col select-none animate-in fade-in duration-150">
          {/* Top Sticky Search Bar */}
          <div className="bg-white border-b border-black/[0.08] px-3.5 pt-3 pb-3 flex items-center gap-2.5 sticky top-0 z-10 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setIsSearchFullscreen(false);
              }}
              className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 flex items-center justify-center text-neutral-700 shrink-0 transition"
              title="Close Search"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
              <input
                ref={fullscreenInputRef}
                type="text"
                autoFocus
                placeholder="Type division #, name, pass #, or phone..."
                value={manualSearchQuery}
                onChange={(e) => setManualSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 text-sm sm:text-base bg-neutral-100 focus:bg-white text-neutral-900 placeholder:text-neutral-400 rounded-2xl border border-transparent focus:border-black/[0.1] focus:ring-2 focus:ring-neutral-900/10 focus:outline-none transition-all"
              />
              {manualSearchQuery && (
                <button
                  type="button"
                  onClick={() => setManualSearchQuery('')}
                  className="w-6 h-6 rounded-full bg-neutral-200 hover:bg-neutral-300 text-neutral-600 flex items-center justify-center absolute right-2.5 transition"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSearchFullscreen(false);
              }}
              className="text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-900 px-2 py-1 shrink-0"
            >
              Cancel
            </button>
          </div>

          {/* Category Filter Chips */}
          <div className="bg-white/90 backdrop-blur-md border-b border-black/[0.04] px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: 'ALL', label: 'All Invitees' },
              { id: 'CORPORATORS', label: 'Corporators (1–76)' },
              { id: 'VIP', label: 'Special Passes' },
              { id: 'TDP', label: 'TDP' },
              { id: 'JSP', label: 'JSP' },
              { id: 'BJP', label: 'BJP' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSearchCategory(cat.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  searchCategory === cat.id
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Results Header Counter */}
          <div className="px-4 pt-3 pb-1 flex items-center justify-between text-xs font-medium text-neutral-500 shrink-0">
            <span>
              {cleanQuery ? `Results for "${manualSearchQuery}"` : searchCategory === 'VIP' ? 'Special & VIP Passes' : searchCategory === 'CORPORATORS' ? 'Divisions 1–76' : 'All Guest Invitees'}
            </span>
            <span className="text-[11px] bg-neutral-200/80 text-neutral-700 px-2 py-0.5 rounded-full font-semibold">
              {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
            </span>
          </div>

          {/* Large Scrollable Result Cards List */}
          <div className="flex-1 overflow-y-auto px-4 py-2 pb-28 space-y-2.5">
            {searchResults.length > 0 ? (
              searchResults.map((w) => {
                const isVip = w.ward_number >= 101 || ['VIP', 'SPECIAL', 'GUEST', 'ALLIANCE'].includes(w.party);
                return (
                  <div
                    key={w.ward_number}
                    onClick={() => {
                      setManualSearchQuery('');
                      handleManualSelect(w.ward_number);
                    }}
                    className="p-3.5 bg-white hover:bg-neutral-50 active:bg-neutral-100 border border-black/[0.06] rounded-2xl flex items-center justify-between cursor-pointer transition-all shadow-2xs active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className={`w-11 h-11 rounded-2xl font-bold text-xs sm:text-sm flex flex-col items-center justify-center shrink-0 shadow-2xs ${
                        isVip ? 'bg-purple-700 text-white' : 'bg-neutral-900 text-white'
                      }`}>
                        <span className="text-[9px] uppercase tracking-tighter opacity-80 leading-none">{isVip ? 'Pass' : 'Div'}</span>
                        <span className="leading-tight">{w.ward_number}</span>
                      </span>

                      <div className="flex flex-col min-w-0">
                        <span className="text-sm sm:text-base font-bold text-neutral-900 truncate group-hover:text-black">
                          {w.candidate_name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500 truncate">
                          <span>{isVip ? `Pass #${w.ward_number}` : `Division ${w.ward_number}`}</span>
                          {w.phone && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{w.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <PartyBadge party={w.party} size="sm" />
                      <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-neutral-400 flex flex-col items-center">
                <Search className="w-10 h-10 text-neutral-300 mb-2 stroke-[1.5]" />
                <p className="text-sm font-semibold text-neutral-700">No invitees found</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                  Try searching by division # (1–76), pass # (101+), candidate name, or phone number.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
