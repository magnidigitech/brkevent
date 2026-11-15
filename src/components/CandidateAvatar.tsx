'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import {
  getCandidatePhotoUrls,
  getCachedCandidatePhotoFromLocalStorage,
  isWinningWard,
} from '@/lib/candidatePhotos';

interface CandidateAvatarProps {
  wardNumber: number;
  candidateName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showWinnerRing?: boolean;
}

export function CandidateAvatar({
  wardNumber,
  candidateName,
  size = 'md',
  className = '',
  showWinnerRing = true,
}: CandidateAvatarProps) {
  const { localUrl, onlineUrl, hasPhoto } = getCandidatePhotoUrls(wardNumber);
  const isWinner = isWinningWard(wardNumber);

  // 1. Initial synchronous check from localStorage (instant 0ms offline)
  const [imgSrc, setImgSrc] = useState<string | null>(() => {
    if (!hasPhoto) return null;
    return getCachedCandidatePhotoFromLocalStorage(wardNumber) || localUrl;
  });
  const [triedOnline, setTriedOnline] = useState(false);
  const [hasError, setHasError] = useState(!hasPhoto);

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

  // Get initials for fallback
  const initials = candidateName
    ? candidateName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : `${wardNumber}`;

  return (
    <div
      className={`relative shrink-0 rounded-2xl overflow-hidden border ${
        isWinner && showWinnerRing
          ? 'border-amber-400/80 shadow-[0_2px_10px_rgba(245,158,11,0.15)] ring-2 ring-amber-400/20'
          : 'border-neutral-200/90 shadow-2xs'
      } ${sizeClasses} ${className}`}
    >
      {!hasError && imgSrc ? (
        <img
          src={imgSrc}
          alt={candidateName || `Candidate Ward ${wardNumber}`}
          onError={handleError}
          className="w-full h-full object-cover object-top transition-transform duration-200"
          loading="eager"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-neutral-100 via-neutral-100 to-neutral-200 flex flex-col items-center justify-center text-neutral-400 select-none">
          <User className={`${iconSizes} text-neutral-400 stroke-[1.75]`} />
        </div>
      )}
    </div>
  );
}
