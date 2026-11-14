'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { QrCode, LayoutDashboard, LogOut, Wifi, ShieldCheck, User } from 'lucide-react';
import { UserProfile } from '@/types/database';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  useEffect(() => {
    // Fetch user profile
    fetch('/api/auth/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.profile) {
          setProfile(data.profile);
        }
      })
      .catch(() => {});

    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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
    } catch {
      router.push('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Event Title */}
          <div className="flex items-center gap-3">
            <Link href="/scanner" className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-slate-950 text-lg shadow-sm">
                BRK
              </span>
              <div className="flex flex-col">
                <span className="font-bold text-sm sm:text-base tracking-tight leading-tight">
                  Bhashyam Ramakrishna
                </span>
                <span className="text-xs text-slate-400 hidden xs:inline">
                  Event Entry Management
                </span>
              </div>
            </Link>

            {/* Connection Status Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                isOnline ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}
              title={isOnline ? 'Device online - Live database sync' : 'Connection offline!'}
            >
              <Wifi className={`w-3 h-3 ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/scanner"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith('/scanner') || pathname.startsWith('/ward')
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden xs:inline">Scanner</span>
            </Link>

            {isAdmin && (
              <Link
                href="/dashboard"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith('/dashboard')
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden xs:inline">Dashboard</span>
              </Link>
            )}

            {/* Staff Role Badge & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
              {profile && (
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-medium text-slate-200 flex items-center gap-1">
                    {profile.role === 'admin' ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    {profile.full_name}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                    {profile.role}
                  </span>
                </div>
              )}

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
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

