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
  const [email, setEmail] = useState<string>('vivek@bhashyamramakrishna.in');
  const [password, setPassword] = useState<string>('Magni@3939');
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
      <div className="w-full max-w-lg mb-6 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
          Ward {wardNumber} Invitation
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1 font-normal">
          Official invitation: event.bhashyamramakrishna.in/{wardSlug}
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
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.06)] border border-black/[0.06] overflow-hidden">
          {/* Card Header with Ward Info (Apple Style) */}
          <div className="bg-white border-b border-black/[0.06] p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base border shadow-2xs ${
                  wardSeed?.party === 'TDP'
                    ? 'bg-[#FFF6CC] text-[#7A5B00] border-[#FFCC00]/40'
                    : wardSeed?.party === 'JSP'
                    ? 'bg-[#FFEBEA] text-[#D70015] border-[#FF3B30]/30'
                    : 'bg-[#FFF1E5] text-[#C93400] border-[#FF9500]/30'
                }`}
              >
                {wardNumber}
              </span>
              <div>
                <span className="text-xs text-neutral-400 font-medium block">
                  Official Event Invitation
                </span>
                <h2 className="text-base sm:text-lg font-semibold text-neutral-900 tracking-tight">
                  {wardSeed?.candidate_name || `Ward ${wardNumber}`}
                </h2>
              </div>
            </div>

            {wardSeed?.party && <PartyBadge party={wardSeed.party} size="sm" />}
          </div>

          <div className="p-4 border-b border-black/[0.06] bg-neutral-50/70 text-xs text-neutral-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong className="text-neutral-900 font-semibold">Ward {wardNumber}</strong> allows <strong className="text-neutral-900 font-semibold">5 people total</strong>. Please unlock with staff credentials to record gate arrivals.
            </span>
          </div>

          {/* Biometric One-Tap Unlock if enabled on this device */}
          {savedBiometric && (
            <div className="p-5 border-b border-black/[0.06] bg-neutral-50 flex flex-col gap-2.5">
              <span className="text-xs font-medium text-neutral-600">
                Fast Biometric Unlock
              </span>
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={loginLoading}
                className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {loginLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-neutral-300" />
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 text-neutral-300" />
                    <span>Unlock with Face ID / Fingerprint</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Inline Staff Sign-In Form */}
          <form onSubmit={(e) => handleInlineLogin(e)} className="p-6 flex flex-col gap-4">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-800 text-xs">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Staff Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-neutral-900 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-neutral-900 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="mt-2 w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
            >
              {loginLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-neutral-300" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Unlock Ward {wardNumber}</span>
                </>
              )}
            </button>
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
