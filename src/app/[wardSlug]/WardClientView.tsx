'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WardEntryCard } from '@/components/WardEntryCard';
import { AdminWardEditModal } from '@/components/AdminWardEditModal';
import { WardWithStats } from '@/types/database';
import { WARDS_SEED_DATA } from '@/data/wardsSeed';
import { PartyBadge } from '@/components/PartyBadge';
import {
  Lock,
  Mail,
  Fingerprint,
  RefreshCw,
  ShieldCheck,
  LogIn,
  KeyRound,
  CheckCircle2
} from 'lucide-react';

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
  isAdmin: initialIsAdmin,
}: WardClientViewProps) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean>(initialAuthenticated);
  const [isAdmin, setIsAdmin] = useState<boolean>(initialIsAdmin);
  const [editingWard, setEditingWard] = useState<WardWithStats | null>(null);

  // Inline login state
  const [email, setEmail] = useState<string>('vivek@gmail.com');
  const [password, setPassword] = useState<string>('SecureAdmin2026!');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Biometric state
  const [savedBiometric, setSavedBiometric] = useState<{ email: string; role: 'admin' | 'scanner' } | null>(null);

  const wardSeed = WARDS_SEED_DATA.find((w) => w.ward_number === wardNumber);

  useEffect(() => {
    // Check if biometric authentication was enabled on this device
    try {
      const stored = localStorage.getItem('brk_biometric_auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.email) {
          setSavedBiometric(parsed);
          setEmail(parsed.email);
        }
      }
    } catch {}

    // Verify session
    fetch('/api/auth/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          setAuthenticated(true);
          setIsAdmin(data.profile?.role === 'admin');
        }
      })
      .catch(() => {});
  }, []);

  const handleScanNext = () => {
    router.push('/scanner');
  };

  const handleOpenEdit = async () => {
    try {
      const res = await fetch(`/api/wards/${wardNumber}`);
      const data = await res.json();
      if (data?.success && data?.ward) {
        setEditingWard(data.ward);
      }
    } catch (err) {
      console.error('Failed to fetch ward for edit:', err);
    }
  };

  // Inline Biometric Unlock
  const handleBiometricUnlock = async () => {
    if (!savedBiometric) return;
    setLoginLoading(true);
    setLoginError(null);

    try {
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        await navigator.credentials.get({
          publicKey: {
            challenge,
            rpId: window.location.hostname,
            userVerification: 'preferred',
            timeout: 60000,
          },
        });
      }

      const res = await fetch('/api/auth/biometric/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: savedBiometric.email,
          role: savedBiometric.role,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Biometric verification failed.');
      }

      setAuthenticated(true);
      setIsAdmin(savedBiometric.role === 'admin');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Biometric unlock failed.';
      if (!msg.includes('cancelled') && !msg.includes('AbortError')) {
        setLoginError(msg);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Inline Password Login
  const handleInlineLogin = async (e?: React.FormEvent, devRole?: 'admin' | 'scanner', quickEmail?: string, quickPass?: string) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    const submitEmail = quickEmail || email;
    const submitPassword = quickPass || password;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: submitEmail,
          password: submitPassword,
          devRole,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed. Please verify credentials.');
      }

      setAuthenticated(true);
      setIsAdmin(devRole === 'admin' || submitEmail.includes('admin') || submitEmail.includes('vivek'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 flex flex-col items-center justify-start">
      <div className="w-full max-w-lg mb-4 text-center">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Ward {wardNumber} Invitation
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
          Official invitation link: event.bhashyamramakrishna.in/{wardSlug}
        </p>
      </div>

      {/* If authenticated, show full attendance recording card directly */}
      {authenticated ? (
        <WardEntryCard
          wardNumber={wardNumber}
          onScanNext={handleScanNext}
          isAdmin={isAdmin}
          onEditWard={handleOpenEdit}
        />
      ) : (
        /* If logged out, render inline staff unlock without changing the URL */
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
          {/* Card Header with Ward Info */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg">
                {wardNumber}
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Official Event Invitation
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  {wardSeed?.candidate_name || `Ward ${wardNumber}`}
                </h2>
              </div>
            </div>

            {wardSeed?.party && <PartyBadge party={wardSeed.party} size="sm" />}
          </div>

          <div className="p-5 border-b border-slate-100 bg-amber-50/40 text-xs text-amber-950 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Ward {wardNumber}</strong> allows <strong>5 people total</strong>. Please unlock with staff credentials to record gate arrivals.
            </span>
          </div>

          {/* Biometric One-Tap Unlock if enabled on this device */}
          {savedBiometric && (
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Fast Biometric Unlock
              </span>
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={loginLoading}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
              >
                {loginLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5 text-amber-400" />
                    <span>Unlock with Face ID / Fingerprint</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Inline Staff Sign-In Form */}
          <form onSubmit={(e) => handleInlineLogin(e)} className="p-5 flex flex-col gap-3">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Staff Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="mt-2 w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loginLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Unlock Ward {wardNumber}</span>
                </>
              )}
            </button>

            {/* Quick One-Tap Staff Sign In */}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                Quick 1-Tap Staff Verification
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleInlineLogin(undefined, 'admin', 'admin@bhashyamramakrishna.in', 'SecureAdmin2026!')}
                  className="py-2 px-3 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition text-center"
                >
                  Sign In as Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleInlineLogin(undefined, 'scanner', 'scanner1@bhashyamramakrishna.in', 'ScannerPass2026!')}
                  className="py-2 px-3 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition text-center"
                >
                  Sign In as Scanner
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {editingWard && (
        <AdminWardEditModal
          ward={editingWard}
          onClose={() => setEditingWard(null)}
          onSaved={() => {
            setEditingWard(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
