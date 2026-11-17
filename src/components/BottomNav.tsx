'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { QrCode, LayoutDashboard, SlidersHorizontal } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide on login page or end-user ticket invitation passes
  if (
    !pathname ||
    pathname === '/login' ||
    pathname.startsWith('/division') ||
    pathname.startsWith('/ward')
  ) {
    return null;
  }

  const isScanner = !!(pathname?.startsWith('/scanner') || pathname?.startsWith('/ward'));
  const isDashboard = !!pathname?.startsWith('/dashboard');

  const handleOpenMenu = () => {
    if (isDashboard) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('open-dashboard-options'));
      }
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white/90 backdrop-blur-2xl border-t border-black/[0.08] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-safe">
      <div className="max-w-md mx-auto px-6 h-16 flex items-center justify-between">
        {/* Dashboard Tab */}
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-95 ${
            isDashboard ? 'text-neutral-900 font-semibold' : 'text-neutral-400 hover:text-neutral-600 font-medium'
          }`}
        >
          <div className={`p-1 rounded-xl transition-colors ${isDashboard ? 'bg-neutral-100' : ''}`}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight">Dashboard</span>
        </Link>

        {/* Dedicated Standout Scanner Action Button */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-5">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('reset-scanner-view'));
                window.scrollTo({ top: 0, behavior: 'instant' });
              }
              router.push('/scanner');
            }}
            className="flex flex-col items-center justify-center active:scale-95 transition-transform group cursor-pointer"
            title="Scan Invitation QR"
            aria-label="Scan Invitation QR"
          >
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white flex flex-col items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.25)] border-2 border-white group-hover:scale-105 transition-all">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <span className={`text-[10px] font-semibold mt-1 tracking-tight ${isScanner ? 'text-neutral-900' : 'text-neutral-500'}`}>
              Scanner
            </span>
          </button>
        </div>

        {/* Dashboard Options / Actions Tab */}
        <button
          type="button"
          onClick={handleOpenMenu}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-95 ${
            isDashboard ? 'text-neutral-900 font-semibold' : 'text-neutral-400 hover:text-neutral-600 font-medium'
          }`}
          title="Open Dashboard Menu"
          aria-label="Open Dashboard Menu"
        >
          <div className="p-1 rounded-xl hover:bg-neutral-100 transition-colors">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight">Options</span>
        </button>
      </div>
    </div>
  );
}

