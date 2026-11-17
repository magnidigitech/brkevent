'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Maximize2, X } from 'lucide-react';
import {
  getCandidatePhotoUrls,
  getCachedCandidatePhotoFromLocalStorage,
  isWinningWard,
} from '@/lib/candidatePhotos';
import winningCorporatorsData from '@/data/winningCorporators.json';
import { PartyBadge } from '@/components/PartyBadge';
import { PartyAffiliation } from '@/types/database';

interface CandidateAvatarProps {
  wardNumber: number;
  candidateName: string;
  candidateNameTe?: string;
  party?: PartyAffiliation;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showWinnerRing?: boolean;
  allowZoom?: boolean;
}

export function CandidateAvatar({
  wardNumber,
  candidateName,
  candidateNameTe,
  party,
  size = 'md',
  className = '',
  showWinnerRing = true,
  allowZoom = true,
}: CandidateAvatarProps) {
  const { localUrl, onlineUrl, hasPhoto } = getCandidatePhotoUrls(wardNumber);
  const isWinner = isWinningWard(wardNumber);

  // Automatic lookup for Telugu name & party if not provided
  const winnerInfo = winningCorporatorsData.find((w) => w.ward === wardNumber);
  const displayNameTe = candidateNameTe || winnerInfo?.nameTe || '';
  const displayNameEn = candidateName || winnerInfo?.nameEn || `Division ${wardNumber}`;
  const displayParty = party || (winnerInfo?.party as 'TDP' | 'JSP' | 'BJP') || 'TDP';

  // 1. Initial synchronous check from localStorage (instant 0ms offline)
  const [imgSrc, setImgSrc] = useState<string | null>(() => {
    if (!hasPhoto) return null;
    return getCachedCandidatePhotoFromLocalStorage(wardNumber) || localUrl;
  });
  const [triedOnline, setTriedOnline] = useState(false);
  const [hasError, setHasError] = useState(!hasPhoto);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hasPhoto) {
      setHasError(true);
      return;
    }

    const cached = getCachedCandidatePhotoFromLocalStorage(wardNumber);
    if (cached) {
      setImgSrc(cached);
      setHasError(false);
    } else {
      setImgSrc(localUrl);
      setHasError(false);
      setTriedOnline(false);
    }
  }, [wardNumber, hasPhoto, localUrl]);

  const handleError = () => {
    if (!triedOnline) {
      // Try online CDN fallback
      setTriedOnline(true);
      setImgSrc(onlineUrl);
    } else {
      // Both local and online failed, switch to fallback avatar icon
      setHasError(true);
    }
  };

  const handleOpenZoom = (e: React.MouseEvent) => {
    if (!allowZoom || hasError || !imgSrc) return;
    e.stopPropagation();
    setIsZoomed(true);
    if (typeof window !== 'undefined') {
      window.history.pushState({ candidatePhotoModal: true, ward: wardNumber }, '', window.location.href);
    }
  };

  const handleCloseZoom = () => {
    setIsZoomed(false);
    if (typeof window !== 'undefined' && window.history.state?.candidatePhotoModal) {
      window.history.back();
    }
  };

  // Synchronize history backpress & Escape key
  useEffect(() => {
    if (!isZoomed) return;

    const handlePopState = () => {
      // Hardware / browser back button or swipe-back dismisses modal smoothly
      setIsZoomed(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseZoom();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    // Prevent background scrolling while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isZoomed]);

  const sizeClasses = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 sm:w-20 sm:h-20 text-base',
    xl: 'w-24 h-24 text-lg',
  }[size];

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8 sm:w-10 sm:h-10',
    xl: 'w-12 h-12',
  }[size];

  const canZoom = allowZoom && !hasError && Boolean(imgSrc);

  return (
    <>
      <div
        onClick={canZoom ? handleOpenZoom : undefined}
        title={canZoom ? 'Click to view full photo' : undefined}
        role={canZoom ? 'button' : undefined}
        tabIndex={canZoom ? 0 : undefined}
        onKeyDown={canZoom ? (e) => e.key === 'Enter' && handleOpenZoom(e as any) : undefined}
        className={`relative shrink-0 rounded-2xl overflow-hidden border ${
          isWinner && showWinnerRing
            ? 'border-amber-400/80 shadow-[0_2px_10px_rgba(245,158,11,0.15)] ring-2 ring-amber-400/20'
            : 'border-neutral-200/90 shadow-2xs'
        } ${sizeClasses} ${canZoom ? 'cursor-pointer group/avatar active:scale-95 hover:shadow-md transition-all' : ''} ${className}`}
      >
        {!hasError && imgSrc ? (
          <>
            <img
              src={imgSrc}
              alt={displayNameEn || `Candidate Ward ${wardNumber}`}
              onError={handleError}
              className="w-full h-full object-cover object-top transition-transform duration-200 group-hover/avatar:scale-105"
              loading="eager"
            />
            {canZoom && (
              <div
                className="absolute bottom-1 right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-black/75 backdrop-blur-xs flex items-center justify-center text-white shadow-xs border border-white/80 group-hover/avatar:bg-neutral-900 transition-colors pointer-events-none"
                title="Tap to zoom"
              >
                <Maximize2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-100 via-neutral-100 to-neutral-200 flex flex-col items-center justify-center text-neutral-400 select-none">
            <User className={`${iconSizes} text-neutral-400 stroke-[1.75]`} />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CLEAN HIGH-RESOLUTION FULL-SCREEN PHOTO MODAL (SAME AS QR CODE ZOOM) */}
      {/* ========================================================================= */}
      {mounted && isZoomed && imgSrc && createPortal(
        <div
          onClick={handleCloseZoom}
          className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-between p-6 select-none animate-in fade-in duration-150 cursor-pointer overflow-y-auto"
        >
          {/* Top Bar */}
          <div className="w-full max-w-md flex items-center justify-between pt-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200 p-0.5 shadow-2xs shrink-0">
                <img
                  src="/images/kutami-logo.jpg"
                  alt="Kutami Alliance"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-neutral-900 leading-tight">
                  {displayNameTe || displayNameEn}
                </span>
                <span className="text-[11px] text-neutral-500 font-medium">
                  Division {wardNumber} ({displayParty})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseZoom();
              }}
              className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 transition-colors active:scale-90"
              title="Close Zoom"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Centered Large High-Resolution Portrait Photo */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col items-center my-auto max-w-sm w-full py-4 cursor-default"
          >
            <div className="p-3 bg-white rounded-3xl border-4 border-amber-400 shadow-xl animate-in zoom-in-95 duration-150">
              <div className="w-64 h-64 sm:w-76 sm:h-76 md:w-80 md:h-80 rounded-2xl overflow-hidden bg-neutral-100 shadow-inner">
                <img
                  src={imgSrc}
                  alt={displayNameEn || `Candidate Ward ${wardNumber}`}
                  className="w-full h-full object-cover object-top select-none"
                />
              </div>
            </div>

            <div className="mt-5 text-center px-4">
              {displayNameTe && (
                <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight leading-snug">
                  {displayNameTe}
                </h2>
              )}
              <p className="text-sm sm:text-base font-semibold text-neutral-600 mt-0.5">
                {displayNameEn}
              </p>
              <div className="mt-2.5 flex items-center justify-center gap-2 flex-wrap">
                <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-neutral-900 text-white">
                  Division {wardNumber} • Admit 5
                </span>
                <PartyBadge party={displayParty} size="sm" />
                {isWinner && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-900 border border-amber-500/30">
                    ★ Winner
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Instructions */}
          <div className="w-full text-center pb-6">
            <span className="text-xs text-neutral-400 font-normal">
              Tap anywhere on screen to close
            </span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
