import React from 'react';
import { PartyAffiliation } from '@/types/database';

interface PartyBadgeProps {
  party: PartyAffiliation | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PartyBadge({ party, size = 'md', className = '' }: PartyBadgeProps) {
  const normalizedParty = (party || '').toUpperCase();

  const sizeClasses = {
    sm: 'text-[11px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-3.5 py-1.5 font-medium',
  }[size];

  // TDP - Telugu Desam Party: Refined Warm Gold & Black
  if (normalizedParty === 'TDP') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#FFF6CC] text-[#7A5B00] border border-[#FFCC00]/40 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${sizeClasses} ${className}`}
        aria-label="Party: TDP"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#1d1d1f] inline-block shrink-0" aria-hidden="true" />
        <span>TDP</span>
      </span>
    );
  }

  // JSP - Janasena Party: Refined Crimson Red & White
  if (normalizedParty === 'JSP' || normalizedParty === 'JANASENA') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#FFEBEA] text-[#D70015] border border-[#FF3B30]/30 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${sizeClasses} ${className}`}
        aria-label="Party: JSP (Janasena)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] inline-block shrink-0" aria-hidden="true" />
        <span>JSP</span>
      </span>
    );
  }

  // BJP - Bharatiya Janata Party: Refined Saffron Orange & Crisp Text
  if (normalizedParty === 'BJP') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#FFF1E5] text-[#C93400] border border-[#FF9500]/30 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${sizeClasses} ${className}`}
        aria-label="Party: BJP"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500] inline-block shrink-0" aria-hidden="true" />
        <span>BJP</span>
      </span>
    );
  }

  // VIP & Special Guests
  if (normalizedParty === 'VIP' || normalizedParty === 'SPECIAL' || normalizedParty === 'GUEST') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${sizeClasses} ${className}`}
        aria-label={`Category: ${party}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block shrink-0" aria-hidden="true" />
        <span>{normalizedParty === 'VIP' ? 'VIP Invitee' : 'Special Guest'}</span>
      </span>
    );
  }

  // NDA / Alliance Guests
  if (normalizedParty === 'ALLIANCE') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${sizeClasses} ${className}`}
        aria-label="Category: Alliance"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block shrink-0" aria-hidden="true" />
        <span>Alliance Guest</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 ${sizeClasses} ${className}`}>
      <span>{party}</span>
    </span>
  );
}
