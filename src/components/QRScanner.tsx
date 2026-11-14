'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, AlertCircle, RefreshCw, Search, X } from 'lucide-react';
import { parseWardQRCode } from '@/lib/qr/parser';
import { WARDS_SEED_DATA } from '@/data/wardsSeed';

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

  // References to handle Html5Qrcode lifecycle and prevent concurrent state transitions
  const scannerRef = useRef<any>(null);
  const isTransitioningRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const qrRegionId = 'qr-reader-container';

  // Stop scanner safely
  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    if (isTransitioningRef.current) return;

    try {
      isTransitioningRef.current = true;
      // Check if scanner is currently active before stopping
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Suppress normal transition or abort warnings
      if (!msg.includes('already under transition') && !msg.includes('not running') && !msg.includes('media was removed')) {
        console.warn('Handled stopScanner warning:', err);
      }
    } finally {
      isTransitioningRef.current = false;
    }
  }, []);

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    const parseResult = parseWardQRCode(decodedText, typeof window !== 'undefined' ? window.location.host : undefined);

    if (!parseResult.valid) {
      setScannedUrlError(parseResult.error || 'Invalid QR code. Please scan an official ward invitation.');
      return;
    }

    setScannedUrlError(null);

    // If dynamic redirect QR (e.g. Canva QR)
    if (parseResult.isDynamicRedirect) {
      try {
        setIsInitializing(true);
        const res = await fetch(`/api/qr/resolve?url=${encodeURIComponent(decodedText)}`);
        const data = await res.json();
        if (data.valid && data.wardNumber) {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate([80, 40, 80]); } catch {}
          }
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
      // Gentle haptic feedback on mobile
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([80, 40, 80]);
        } catch {
          // Ignore vibrate restrictions
        }
      }
      onWardScanned(parseResult.wardNumber);
    }
  }, [onWardScanned]);

  // Start scanner safely with transition protection
  const startScanner = useCallback(async () => {
    if (!isMountedRef.current || isPaused) return;
    if (isTransitioningRef.current) return;

    setCameraError(null);
    setScannedUrlError(null);
    setIsInitializing(true);
    isTransitioningRef.current = true;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (!isMountedRef.current) return;

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
        await scannerRef.current.stop();
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
        // Safe lifecycle transition, do not show error banner to staff
        return;
      }

      console.warn('Handled camera start issue:', err);
      let errMsg = 'Could not access the camera. Please check camera permissions in your browser settings.';
      if (errObj.name === 'NotAllowedError' || msg.includes('Permission') || msg.includes('denied')) {
        errMsg = 'Camera permission was denied. Please allow camera access in your browser to scan invitations.';
      } else if (errObj.name === 'NotFoundError' || msg.includes('not found')) {
        errMsg = 'No camera detected on this device. Please use manual ward search below.';
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
      stopScanner();
    } else if (scannerActive) {
      // Small timeout allows DOM to fully settle before requesting video stream
      const timer = setTimeout(() => {
        if (isMountedRef.current && !isPaused) {
          startScanner();
        }
      }, 100);
      return () => clearTimeout(timer);
    }

    return () => {
      isMountedRef.current = false;
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

  // Live AJAX search filtering for manual lookup
  const cleanQuery = manualSearchQuery.toLowerCase().trim();
  const searchResults = WARDS_SEED_DATA.filter((w) => {
    if (!cleanQuery) return false;
    return (
      w.ward_number.toString() === cleanQuery ||
      `ward ${w.ward_number}`.includes(cleanQuery) ||
      w.candidate_name.toLowerCase().includes(cleanQuery) ||
      w.party.toLowerCase().includes(cleanQuery)
    );
  }).slice(0, 10);

  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-4">
      {/* Scanner Card */}
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Scanner Viewport Header */}
        <div className="bg-slate-900 px-4 py-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold text-sm sm:text-base">Camera Invitation Scanner</h2>
          </div>

          <button
            onClick={toggleScanner}
            disabled={isInitializing}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
              scannerActive
                ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
            }`}
          >
            {scannerActive ? (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>Stop Camera</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>Start Camera</span>
              </>
            )}
          </button>
        </div>

        {/* Camera Box */}
        <div className="relative bg-slate-950 min-h-[300px] flex items-center justify-center overflow-hidden">
          {/* HTML5 QR Container */}
          <div
            id={qrRegionId}
            className={`w-full max-w-[320px] aspect-square transition-opacity duration-300 ${
              scannerActive && !cameraError ? 'opacity-100' : 'opacity-0 h-0 hidden'
            }`}
          />

          {/* Loading State */}
          {isInitializing && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white gap-2 z-10">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
              <span className="text-sm font-medium">Starting rear camera...</span>
            </div>
          )}

          {/* Stopped State */}
          {!scannerActive && !cameraError && (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-3">
              <CameraOff className="w-12 h-12 text-slate-500" />
              <p className="text-sm font-medium">Camera is paused.</p>
              <button
                onClick={toggleScanner}
                className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-sm font-bold shadow hover:bg-amber-400 transition"
              >
                Turn On Camera
              </button>
            </div>
          )}

          {/* Camera Permission / Error Message */}
          {cameraError && (
            <div className="p-6 text-center text-slate-300 flex flex-col items-center gap-3">
              <AlertCircle className="w-10 h-10 text-rose-400" />
              <p className="text-xs sm:text-sm text-rose-200">{cameraError}</p>
              <button
                onClick={startScanner}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Camera Permission</span>
              </button>
            </div>
          )}
        </div>

        {/* Scanned QR Validation Error Banner */}
        {scannedUrlError && (
          <div className="bg-rose-50 border-t border-b border-rose-200 p-4 flex items-start gap-3 text-rose-900">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-rose-800">Scanned QR Code Rejected</p>
              <p className="text-rose-700 mt-0.5">{scannedUrlError}</p>
              <p className="text-[11px] text-rose-600 mt-1">
                Only official invitations (https://event.bhashyamramakrishna.in/ward1 .. ward76) are recognized.
              </p>
            </div>
          </div>
        )}

        {/* Scanner Footnote */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-600">
            Point camera at the printed QR code on the invitation card.
          </p>
        </div>
      </div>

      {/* AJAX Ward Search Card Style Fallback */}
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm sm:text-base">
            <Search className="w-4 h-4 text-amber-600" />
            <span>Instant Ward Search</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">76 Wards</span>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Type a ward number (1–76), candidate name, or party to look up invitations instantly.
        </p>

        {/* Search Input Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Type ward number or candidate name..."
            value={manualSearchQuery}
            onChange={(e) => setManualSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
          />
          {manualSearchQuery && (
            <button
              onClick={() => setManualSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Live Search Result Cards */}
        {searchResults.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 max-h-64 overflow-y-auto">
            {searchResults.map((w) => (
              <div
                key={w.ward_number}
                onClick={() => {
                  setManualSearchQuery('');
                  handleManualSelect(w.ward_number);
                }}
                className="p-3 bg-slate-50 hover:bg-amber-50/70 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center">
                    {w.ward_number}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">
                      {w.candidate_name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Ward {w.ward_number} • Allowance: 5 people
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      w.party === 'TDP'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : w.party === 'JSP'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : 'bg-orange-100 text-orange-950 border border-orange-300'
                    }`}
                  >
                    {w.party}
                  </span>
                  <span className="text-xs font-semibold text-amber-700 bg-white px-2 py-1 rounded-lg border border-slate-200">
                    Select →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Ward Grid for Direct Tap */}
        {!cleanQuery && (
          <div className="mt-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Quick Jump (Popular / Initial Wards)
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {[1, 2, 5, 6, 10, 18, 24, 33, 41, 42, 51, 64].map((num) => {
                const w = WARDS_SEED_DATA.find((x) => x.ward_number === num);
                return (
                  <button
                    key={num}
                    onClick={() => handleManualSelect(num)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-center transition border border-slate-200/80 active:bg-amber-200"
                  >
                    <span className="font-bold text-xs text-slate-800 block">W-{num}</span>
                    <span className="text-[9px] text-slate-500 uppercase">{w?.party}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
