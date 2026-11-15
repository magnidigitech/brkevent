'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { WARDS_SEED_DATA } from '@/data/wardsSeed';
import { PartyBadge } from '@/components/PartyBadge';
import { Maximize2, X, QrCode } from 'lucide-react';

interface WardClientViewProps {
  wardNumber: number;
  wardSlug: string;
  initialAuthenticated: boolean;
  isAdmin: boolean;
}

export function WardClientView({
  wardNumber,
  wardSlug,
  initialAuthenticated,
  isAdmin,
}: WardClientViewProps) {
  const seedWard = WARDS_SEED_DATA.find((w) => w.ward_number === wardNumber);
  const [candidateName, setCandidateName] = useState<string>(
    seedWard?.candidate_name || `Division ${wardNumber}`
  );
  const [party, setParty] = useState<'TDP' | 'JSP' | 'BJP'>(seedWard?.party || 'TDP');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  // The canonical URL to encode into the QR code
  const targetUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${wardSlug}`
    : `https://event.bhashyamramakrishna.in/${wardSlug}`;

  // Generate crisp vector SVG QR code
  useEffect(() => {
    QRCode.toString(targetUrl, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((svg) => setQrSvg(svg))
      .catch((err) => console.error('Error generating QR SVG:', err));
  }, [targetUrl]);

  // Fetch live ward details in background (if candidate name was updated by admin)
  useEffect(() => {
    fetch(`/api/wards/${wardNumber}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.ward?.candidate_name) {
          setCandidateName(data.ward.candidate_name);
          if (data.ward.party) setParty(data.ward.party);
        }
      })
      .catch(() => {});
  }, [wardNumber]);

  const handleOpenZoom = () => {
    setIsZoomed(true);
    if (typeof window !== 'undefined') {
      window.history.pushState({ qrZoom: true, ward: wardNumber }, '', window.location.href);
    }
  };

  const handleCloseZoom = () => {
    setIsZoomed(false);
    if (typeof window !== 'undefined' && window.history.state?.qrZoom) {
      window.history.back();
    }
  };

  // Synchronize history backpress & Escape key
  useEffect(() => {
    if (!isZoomed) return;

    const handlePopState = () => {
      // Hardware / browser back button or swipe-back dismisses zoom modal smoothly
      setIsZoomed(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseZoom();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isZoomed]);

  return (
    <div className="flex-1 min-h-screen py-8 sm:py-12 px-4 flex flex-col items-center justify-center bg-[#f5f5f7]">
      {/* ========================================================================= */}
      {/* SIMPLE VIP INVITATION PASS CARD */}
      {/* ========================================================================= */}
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-black/[0.08] overflow-hidden flex flex-col transition-all">
        
        {/* Card Header with Kutami Logo & Felicitation Text */}
        <div className="pt-7 px-6 pb-4 flex flex-col items-center text-center bg-white">
          {/* Kutami Alliance Logo */}
          <div className="w-16 h-16 rounded-2xl bg-white shadow-xs border border-neutral-200/80 p-1 flex items-center justify-center mb-3.5">
            <img
              src="/images/kutami-logo.jpg"
              alt="Kutami Alliance"
              className="w-full h-full object-contain rounded-xl"
            />
          </div>

          <span className="text-[11px] uppercase tracking-widest text-neutral-400 font-semibold mb-1">
            Official Invitation Pass
          </span>

          <h2 className="text-xs sm:text-sm text-neutral-600 font-normal leading-relaxed max-w-xs px-2">
            You are cordially invited to the Grand Felicitation by
          </h2>

          <h1 className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight mt-1">
            Sri Bhashyam Ramakrishna Garu
          </h1>
          <span className="text-xs text-amber-700 font-medium mt-0.5">
            Member of Parliament (Rajya Sabha)
          </span>
        </div>

        {/* Ticket Perforation / Divider */}
        <div className="relative my-1">
          <div className="border-t border-dashed border-neutral-200" />
          <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#f5f5f7] border-r border-neutral-200/90" />
          <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#f5f5f7] border-l border-neutral-200/90" />
        </div>

        {/* Invitee Details Section */}
        <div className="pt-4 px-6 pb-2 text-center flex flex-col items-center">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-neutral-900 text-white shadow-2xs">
              Division {wardNumber}
            </span>
            <PartyBadge party={party} size="sm" />
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight leading-snug">
            {candidateName}
          </h3>

          <span className="text-xs text-neutral-400 mt-1 font-normal">
            Admit: 5 Persons Total
          </span>
        </div>

        {/* QR Code Container with Click to Zoom */}
        <div className="p-6 pt-3 flex flex-col items-center">
          <button
            type="button"
            onClick={handleOpenZoom}
            className="group relative bg-white p-3 rounded-2xl border-2 border-neutral-900/10 hover:border-neutral-900 shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex flex-col items-center"
            title="Click to enlarge QR code"
          >
            {/* Rendered SVG QR code */}
            {qrSvg ? (
              <div
                className="w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center bg-neutral-100 rounded-xl animate-pulse">
                <QrCode className="w-12 h-12 text-neutral-400" />
              </div>
            )}

            {/* Click to Zoom Pill */}
            <div className="mt-2.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 text-white text-[11px] font-medium shadow-xs group-hover:bg-neutral-800 transition-colors">
              <Maximize2 className="w-3 h-3" />
              <span>Tap to Zoom</span>
            </div>
          </button>

          <p className="text-[11px] text-neutral-400 text-center mt-3 font-normal max-w-xs">
            Please present this QR code at the entrance gate for quick verification.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CLEAN HIGH-CONTRAST ZOOM MODAL */}
      {/* ========================================================================= */}
      {isZoomed && (
        <div
          onClick={handleCloseZoom}
          className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-between p-6 select-none animate-in fade-in duration-150 cursor-pointer"
        >
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white border border-neutral-200 p-0.5 shadow-2xs">
                <img
                  src="/images/kutami-logo.jpg"
                  alt="Kutami"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-neutral-900 leading-tight">
                  {candidateName}
                </span>
                <span className="text-[11px] text-neutral-500 font-medium">
                  Division {wardNumber} ({party})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseZoom();
              }}
              className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 transition-colors"
              title="Close Zoom"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Centered Large QR Code */}
          <div className="flex flex-col items-center my-auto">
            <div className="p-3 bg-white rounded-3xl border-4 border-black shadow-lg">
              {qrSvg && (
                <div
                  className="w-72 h-72 sm:w-80 sm:h-80 [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              )}
            </div>

            <div className="mt-5 text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                {candidateName}
              </h2>
              <span className="inline-block mt-1 px-3.5 py-1 rounded-full text-xs font-semibold bg-neutral-900 text-white">
                Division {wardNumber} • Admit 5
              </span>
            </div>
          </div>

          {/* Bottom Instructions */}
          <div className="w-full text-center pb-6">
            <span className="text-xs text-neutral-400 font-normal">
              Tap anywhere on screen to close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
