'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, AlertCircle, RefreshCw, Search } from 'lucide-react';
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
  const [manualWardInput, setManualWardInput] = useState<string>('');
  const [manualSearchQuery, setManualSearchQuery] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(false);

  // Reference for Html5Qrcode instance
  const scannerRef = useRef<any>(null);
  const isScanningRef = useRef<boolean>(false);
  const qrRegionId = 'qr-reader-container';

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && isScanningRef.current) {
      try {
        await scannerRef.current.stop();
        isScanningRef.current = false;
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
    }
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
    const parseResult = parseWardQRCode(decodedText, window.location.host);

    if (!parseResult.valid) {
      setScannedUrlError(parseResult.error || 'Invalid QR code. Please scan an official ward invitation.');
      // Keep scanner running so staff can scan another, but show clear warning
      return;
    }

    setScannedUrlError(null);
    if (parseResult.wardNumber) {
      // Vibrate if mobile device supports it
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      onWardScanned(parseResult.wardNumber);
    }
  }, [onWardScanned]);

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setScannedUrlError(null);
    setIsInitializing(true);

    try {
      // Dynamically import html5-qrcode on client side only
      const { Html5Qrcode } = await import('html5-qrcode');

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(qrRegionId);
      }

      if (isScanningRef.current) {
        await scannerRef.current.stop();
        isScanningRef.current = false;
      }

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0,
      };

      // Prefer rear camera (environment)
      await scannerRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText: string) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame error (no QR in view), can be safely ignored
        }
      );

      isScanningRef.current = true;
      setScannerActive(true);
    } catch (err: unknown) {
      console.error('Camera initialization error:', err);
      let errMsg = 'Could not access the camera. Please check camera permissions in your browser settings.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.message.includes('Permission')) {
          errMsg = 'Camera permission was denied. Please allow camera access in your browser settings to scan invitations.';
        } else if (err.name === 'NotFoundError') {
          errMsg = 'No camera found on this device. Please use manual ward lookup below.';
        }
      }
      setCameraError(errMsg);
      setScannerActive(false);
    } finally {
      setIsInitializing(false);
    }
  }, [handleScanSuccess]);

  // Pause or resume scanner based on prop `isPaused`
  useEffect(() => {
    if (isPaused) {
      stopScanner();
    } else if (scannerActive && !isScanningRef.current) {
      startScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isPaused, scannerActive, startScanner, stopScanner]);

  const toggleScanner = async () => {
    if (scannerActive) {
      await stopScanner();
      setScannerActive(false);
    } else {
      setScannerActive(true);
      await startScanner();
    }
  };

  const handleManualSelect = (wardNumber: number) => {
    setScannedUrlError(null);
    onWardScanned(wardNumber);
  };

  // Filter wards for manual search
  const filteredWards = WARDS_SEED_DATA.filter((w) => {
    const q = manualSearchQuery.toLowerCase().trim();
    if (!q) return false;
    return (
      w.ward_number.toString() === q ||
      w.candidate_name.toLowerCase().includes(q) ||
      w.party.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Scanner Container */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Scanner Viewport Header */}
        <div className="bg-slate-900 px-4 py-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold text-sm sm:text-base">Camera Invitation Scanner</h2>
          </div>

          <button
            onClick={toggleScanner}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
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
            className={`w-full max-w-[340px] aspect-square transition-opacity duration-300 ${
              scannerActive && !cameraError ? 'opacity-100' : 'opacity-0 h-0 hidden'
            }`}
          />

          {/* Loading or Stopped State */}
          {!scannerActive && !cameraError && (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-3">
              <CameraOff className="w-12 h-12 text-slate-500" />
              <p className="text-sm font-medium">Camera is paused.</p>
              <button
                onClick={toggleScanner}
                className="px-4 py-2 bg-amber-500 text-slate-950 rounded-lg text-sm font-bold shadow hover:bg-amber-400 transition"
              >
                Turn On Camera
              </button>
            </div>
          )}

          {isInitializing && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white gap-2 z-10">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
              <span className="text-sm font-medium">Starting rear camera...</span>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div className="p-6 text-center text-slate-300 flex flex-col items-center gap-3">
              <AlertCircle className="w-10 h-10 text-rose-400" />
              <p className="text-sm text-rose-200">{cameraError}</p>
              <button
                onClick={startScanner}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Camera Permission</span>
              </button>
            </div>
          )}
        </div>

        {/* Scanned QR Validation Error Alert */}
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

        {/* Scanner Instructions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-600">
            Point camera at the printed QR code on the invitation card.
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Rear camera is prioritized. Scanning pauses automatically when an invitation is detected.
          </p>
        </div>
      </div>

      {/* Manual Ward Fallback Lookup */}
      <div className="w-full max-w-md mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-2 text-slate-800 mb-2">
          <Search className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-sm sm:text-base">Manual Ward Lookup</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          If the printed QR code is damaged or camera access is unavailable, select or enter the ward number directly.
        </p>

        {/* Quick Ward Number Dropdown & Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search ward # or candidate..."
              value={manualSearchQuery}
              onChange={(e) => setManualSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <select
            value={manualWardInput}
            onChange={(e) => {
              const val = e.target.value;
              setManualWardInput(val);
              if (val) handleManualSelect(parseInt(val, 10));
            }}
            className="w-36 px-3 py-2.5 text-sm font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Select Ward</option>
            {WARDS_SEED_DATA.map((w) => (
              <option key={w.ward_number} value={w.ward_number}>
                Ward {w.ward_number} ({w.party})
              </option>
            ))}
          </select>
        </div>

        {/* Search Results Dropdown Preview */}
        {filteredWards.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {filteredWards.map((w) => (
              <button
                key={w.ward_number}
                type="button"
                onClick={() => {
                  setManualSearchQuery('');
                  handleManualSelect(w.ward_number);
                }}
                className="w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between hover:bg-amber-50 transition"
              >
                <div>
                  <span className="font-bold text-slate-900 mr-2">Ward {w.ward_number}</span>
                  <span className="text-slate-700">{w.candidate_name}</span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {w.party}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
