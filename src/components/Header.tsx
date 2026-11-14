'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  QrCode,
  LayoutDashboard,
  LogOut,
  Wifi,
  User,
  ShieldCheck
} from 'lucide-react';
import { UserProfile } from '@/types/database';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  useEffect(() => {
    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Fetch logged in profile
    fetch('/api/auth/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setProfile(data.user);
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <header className="bg-white/80 backdrop-blur-2xl border-b border-black/[0.06] sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Event Title */}
          <div className="flex items-center gap-3">
            <Link href="/scanner" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center justify-center p-0.5 border border-black/[0.06] shrink-0 group-hover:scale-105 transition-transform">
                <img
                  src="/images/kutami-logo.jpg"
                  alt="Kutami Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm sm:text-base text-neutral-900 tracking-tight leading-tight">
                  Bhashyam Ramakrishna
                </span>
                <span className="text-[11px] text-neutral-500 font-normal hidden xs:inline">
                  Event Entry Management
                </span>
              </div>
            </Link>

            {/* Connection Status Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-800 border border-rose-500/20'
              }`}
              title={isOnline ? 'Device online - Live database sync' : 'Connection offline!'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* Navigation Links (Apple Style Segmented Pills) */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/scanner"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-[0.98] ${
                pathname?.startsWith('/scanner') || pathname?.startsWith('/ward')
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Scanner</span>
            </Link>

            {isAdmin && (
              <Link
                href="/dashboard"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-[0.98] ${
                  pathname?.startsWith('/dashboard')
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Dashboard</span>
              </Link>
            )}

            {/* Staff Role Badge & Logout */}
            <div className="flex items-center gap-2 pl-2 sm:pl-3 ml-1 border-l border-neutral-200">
              {profile && (
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-medium text-neutral-800 flex items-center gap-1">
                    {profile.role === 'admin' ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-neutral-900" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-neutral-500" />
                    )}
                    {profile.full_name}
                  </span>
                  <span className="text-[10px] capitalize text-neutral-400 font-medium">
                    {profile.role}
                  </span>
                </div>
              )}

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition active:scale-95"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
