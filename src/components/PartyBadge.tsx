import React from 'react';
import { PartyAffiliation } from '@/types/database';

interface PartyBadgeProps {
  party: PartyAffiliation | string;
  size?: 'sm' | 'md' | 'lg';
}

export function PartyBadge({ party, size = 'md' }: PartyBadgeProps) {
  const normalizedParty = (party || '').toUpperCase();

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs md:text-sm px-2.5 py-1',
    lg: 'text-sm md:text-base px-3 py-1.5 font-semibold',
  }[size];

  if (normalizedParty === 'TDP') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-100 text-amber-900 border border-amber-300 ${sizeClasses}`}
        aria-label="Party: TDP"
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" aria-hidden="true" />
        <span>TDP</span>
      </span>
    );
  }

  if (normalizedParty === 'JSP' || normalizedParty === 'JANASENA') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-rose-100 text-rose-900 border border-rose-300 ${sizeClasses}`}
        aria-label="Party: JSP (Janasena)"
      >
        <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" aria-hidden="true" />
        <span>JSP</span>
      </span>
    );
  }

  if (normalizedParty === 'BJP') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-orange-100 text-orange-950 border border-orange-300 ${sizeClasses}`}
        aria-label="Party: BJP"
      >
        <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" aria-hidden="true" />
        <span>BJP</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-full bg-slate-100 text-slate-800 border border-slate-300 ${sizeClasses}`}>
      <span>{party}</span>
    </span>
  );
}
