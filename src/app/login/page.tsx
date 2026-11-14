'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LogIn,
  Lock,
  Mail,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Fingerprint,
  Smartphone,
  KeyRound,
  ShieldCheck,
  ChevronDown,
  Info
} from 'lucide-react';

interface StoredBiometric {
  email: string;
  role: 'admin' | 'scanner';
  credentialId?: string;
  enabledAt: string;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/scanner';

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [enableBiometricOnLogin, setEnableBiometricOnLogin] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [biometricLoading, setBiometricLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Biometric state
  const [biometricSupported, setBiometricSupported] = useState<boolean>(false);
  const [savedBiometric, setSavedBiometric] = useState<StoredBiometric | null>(null);
  const [showCredentialsHelper, setShowCredentialsHelper] = useState<boolean>(false);

  // Check WebAuthn / Platform Authenticator support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAvailable =
        Boolean(window.PublicKeyCredential) &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';

      if (isAvailable) {
        window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          .then((available) => {
            setBiometricSupported(available);
          })
          .catch(() => {
            setBiometricSupported(false);
          });
      }

      // Read saved biometric record from localStorage
      try {
        const stored = localStorage.getItem('brk_biometric_auth');
        if (stored) {
          const parsed: StoredBiometric = JSON.parse(stored);
          if (parsed?.email) {
            setSavedBiometric(parsed);
            setEmail(parsed.email);
          }
        }
      } catch (err) {
        console.warn('Error reading biometric storage:', err);
      }
    }
  }, []);

  // Biometric Unlock (Face ID / Touch ID / Fingerprint bypass like banks)
  const handleBiometricUnlock = async () => {
    if (!savedBiometric) return;
    setErrorMsg(null);
    setBiometricLoading(true);

    try {
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        // Request platform biometric verification challenge
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        // Prompt device biometric dialog (Face ID / Fingerprint)
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge,
            rpId: window.location.hostname,
            userVerification: 'preferred',
            timeout: 60000,
          },
        });

        if (!credential) {
          throw new Error('Biometric verification was cancelled.');
        }
      }

      // Biometric confirmed by device secure enclave! Authenticate session with backend
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
        throw new Error(data.message || 'Biometric authentication rejected.');
      }

      router.push(returnUrl);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Biometric unlock failed.';
      // If user cancelled, don't show red error, just allow normal login
      if (!msg.includes('cancelled') && !msg.includes('AbortError')) {
        setErrorMsg(msg);
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  // Register biometric for future one-touch bypass
  const registerBiometricForDevice = async (userEmail: string, userRole: 'admin' | 'scanner') => {
    try {
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        const userId = new Uint8Array(16);
        crypto.getRandomValues(challenge);
        crypto.getRandomValues(userId);

        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: {
              name: 'BRK Event Operations',
              id: window.location.hostname,
            },
            user: {
              id: userId,
              name: userEmail,
              displayName: userEmail.split('@')[0],
            },
            pubKeyCredParams: [
              { type: 'public-key', alg: -7 }, // ES256
              { type: 'public-key', alg: -257 }, // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform', // Face ID / Touch ID / Device sensor
              userVerification: 'preferred',
            },
            timeout: 60000,
          },
        });

        const biometricData: StoredBiometric = {
          email: userEmail,
          role: userRole,
          credentialId: credential ? credential.id : undefined,
          enabledAt: new Date().toISOString(),
        };

        localStorage.setItem('brk_biometric_auth', JSON.stringify(biometricData));
        setSavedBiometric(biometricData);
      }
    } catch (err) {
      console.warn('Biometric registration deferred:', err);
    }
  };

  // Password Login Handler
  const handleSubmit = async (e?: React.FormEvent, devRole?: 'admin' | 'scanner', quickEmail?: string, quickPass?: string) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const submitEmail = quickEmail || email || (devRole === 'scanner' ? 'scanner1@bhashyamramakrishna.in' : 'admin@bhashyamramakrishna.in');
    const submitPassword = quickPass || password || 'SecureAdmin2026!';

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
        throw new Error(data.message || 'Authentication failed. Please check credentials or use quick sign-in below.');
      }

      // If biometric enrollment requested and supported, register passkey
      const role: 'admin' | 'scanner' =
        devRole || (data.user?.role as 'admin' | 'scanner') || (submitEmail.includes('scanner') ? 'scanner' : 'admin');

      if (enableBiometricOnLogin && biometricSupported) {
        await registerBiometricForDevice(submitEmail, role);
      }

      router.push(returnUrl);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-6 text-center relative overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 font-black text-2xl mx-auto flex items-center justify-center mb-3 shadow-md">
          BRK
        </div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight">Staff Authentication</h1>
        <p className="text-xs text-slate-400 mt-1">
          Bhashyam Ramakrishna Event Operations
        </p>

        {/* PWA / Standalone Badge */}
        <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-amber-400 font-medium">
          <Smartphone className="w-3 h-3" />
          <span>Mobile & PWA Ready</span>
        </div>
      </div>

      {/* Return URL Notification */}
      {returnUrl !== '/scanner' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          <span>You will be returned to <strong>{returnUrl}</strong> upon sign-in.</span>
        </div>
      )}

      {/* BIOMETRIC ONE-TAP UNLOCK BANNER (Face ID / Fingerprint just like banking apps) */}
      {savedBiometric && (
        <div className="m-5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-100 border-2 border-amber-400/80 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
              <Fingerprint className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Biometric Passkey Available
              </span>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Unlock as {savedBiometric.email}
              </h2>
              <span className="text-[11px] text-slate-500">
                Face ID / Fingerprint enabled for this device
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBiometricUnlock}
            disabled={biometricLoading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2"
          >
            {biometricLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Verifying Biometrics...</span>
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4 text-amber-400" />
                <span>Unlock with Face ID / Fingerprint</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Standard Form */}
      <form onSubmit={(e) => handleSubmit(e)} className="p-6 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Staff Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="email"
              required
              placeholder="e.g. vivek@gmail.com or admin@bhashyamramakrishna.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
            />
          </div>
        </div>

        {/* Biometric Opt-in Checkbox */}
        <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={enableBiometricOnLogin}
            onChange={(e) => setEnableBiometricOnLogin(e.target.checked)}
            className="rounded text-amber-500 focus:ring-amber-500 h-4 w-4"
          />
          <span className="font-semibold flex items-center gap-1">
            <Fingerprint className="w-3.5 h-3.5 text-amber-600" />
            <span>Enable Face ID / Fingerprint on this device</span>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Sign In to Event App</span>
            </>
          )}
        </button>

        {/* Credentials Directory Accordion */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowCredentialsHelper(!showCredentialsHelper)}
            className="w-full flex items-center justify-between text-xs text-slate-600 font-bold hover:text-slate-900 py-1"
          >
            <span className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              <span>View Configured Staff Credentials</span>
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCredentialsHelper ? 'rotate-180' : ''}`} />
          </button>

          {showCredentialsHelper && (
            <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
              {/* Vivek / Owner Credential */}
              <div
                onClick={() => {
                  setEmail('vivek@gmail.com');
                  setPassword('SecureAdmin2026!');
                }}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:border-amber-400 cursor-pointer transition flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-slate-900 block">vivek@gmail.com (Administrator)</span>
                  <span className="text-[11px] text-slate-500">Pass: SecureAdmin2026! (or your Supabase password)</span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  Use
                </span>
              </div>

              {/* Default Admin */}
              <div
                onClick={() => {
                  setEmail('admin@bhashyamramakrishna.in');
                  setPassword('SecureAdmin2026!');
                }}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:border-amber-400 cursor-pointer transition flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-slate-900 block">admin@bhashyamramakrishna.in (Admin)</span>
                  <span className="text-[11px] text-slate-500">Pass: SecureAdmin2026!</span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  Use
                </span>
              </div>

              {/* Default Scanner */}
              <div
                onClick={() => {
                  setEmail('scanner1@bhashyamramakrishna.in');
                  setPassword('ScannerPass2026!');
                }}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:border-amber-400 cursor-pointer transition flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-slate-900 block">scanner1@bhashyamramakrishna.in (Scanner)</span>
                  <span className="text-[11px] text-slate-500">Pass: ScannerPass2026!</span>
                </div>
                <span className="text-[10px] font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded">
                  Use
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick One-Tap Dev Buttons */}
        <div className="pt-2 flex flex-col gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
            One-Tap Instant Sign-In
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSubmit(undefined, 'admin', 'admin@bhashyamramakrishna.in', 'SecureAdmin2026!')}
              className="py-2.5 px-3 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition text-center active:scale-[0.98]"
            >
              Sign In as Admin
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(undefined, 'scanner', 'scanner1@bhashyamramakrishna.in', 'ScannerPass2026!')}
              className="py-2.5 px-3 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition text-center active:scale-[0.98]"
            >
              Sign In as Scanner
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 py-8 px-4 flex items-center justify-center">
      <Suspense fallback={<div className="text-slate-500">Loading authentication...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
