'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LogIn,
  Lock,
  Mail,
  ShieldAlert,
  RefreshCw,
  Fingerprint,
  Eye,
  EyeOff,
  CheckCircle2
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
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [enableBiometricOnLogin, setEnableBiometricOnLogin] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [biometricLoading, setBiometricLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Biometric state
  const [biometricSupported, setBiometricSupported] = useState<boolean>(false);
  const [savedBiometric, setSavedBiometric] = useState<StoredBiometric | null>(null);

  // Check WebAuthn support on mount
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

  // Biometric Unlock (Face ID / Touch ID)
  const handleBiometricUnlock = async () => {
    if (!savedBiometric) return;
    setErrorMsg(null);
    setBiometricLoading(true);

    try {
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        const credential = await navigator.credentials.get({
          publicKey: {
            challenge,
            rpId: window.location.hostname,
            userVerification: 'preferred',
            timeout: 60000,
          },
        });

        if (!credential) {
          throw new Error('Biometric verification cancelled.');
        }
      }

      const res = await fetch('/api/auth/biometric/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: savedBiometric.email }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Biometric authentication failed.');
      }

      router.push(returnUrl);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Biometric sign-in failed.';
      setErrorMsg(msg);
    } finally {
      setBiometricLoading(false);
    }
  };

  // Register Biometric passkey on successful password login
  const registerBiometricForDevice = async (userEmail: string) => {
    try {
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const userIdBytes = new TextEncoder().encode(userEmail);

        const newCredential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: {
              name: 'BRK Event Operations',
              id: window.location.hostname,
            },
            user: {
              id: userIdBytes,
              name: userEmail,
              displayName: userEmail,
            },
            pubKeyCredParams: [
              { alg: -7, type: 'public-key' },
              { alg: -257, type: 'public-key' },
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'preferred',
              residentKey: 'preferred',
            },
            timeout: 60000,
            attestation: 'none',
          },
        });

        const credId = newCredential ? (newCredential as any).id : undefined;

        const record: StoredBiometric = {
          email: userEmail,
          role: 'admin',
          credentialId: credId,
          enabledAt: new Date().toISOString(),
        };

        localStorage.setItem('brk_biometric_auth', JSON.stringify(record));
        setSavedBiometric(record);
      }
    } catch (err) {
      console.warn('Biometric enrollment skipped or unavailable:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const submitEmail = email.trim();
    const submitPassword = password;

    if (!submitEmail || !submitPassword) {
      setErrorMsg('Please enter both your email address and password.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: submitEmail,
          password: submitPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid email address or password.');
      }

      if (enableBiometricOnLogin && biometricSupported) {
        await registerBiometricForDevice(submitEmail);
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
    <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
      {/* Header */}
      <div className="p-8 pb-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 font-black text-2xl mx-auto flex items-center justify-center mb-4 shadow-sm">
          BRK
        </div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">Staff Sign In</h1>
        <p className="text-xs text-slate-500 mt-1">
          Bhashyam Ramakrishna Event Operations
        </p>
      </div>

      {/* Return URL Notification */}
      {returnUrl !== '/scanner' && returnUrl !== '/dashboard' && (
        <div className="mx-6 mb-4 px-3 py-2 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Redirecting to <strong>{returnUrl}</strong> after sign in.</span>
        </div>
      )}

      {/* Biometric One-Tap Unlock if already enrolled on this device */}
      {savedBiometric && (
        <div className="mx-6 mb-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Fingerprint className="w-4 h-4 text-amber-600" />
              <span>Fast Biometric Unlock</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">{savedBiometric.email.split('@')[0]}</span>
          </div>

          <button
            type="button"
            onClick={handleBiometricUnlock}
            disabled={biometricLoading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 active:scale-98"
          >
            {biometricLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Verifying Biometric...</span>
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4 text-amber-400" />
                <span>Sign In with Face ID / Fingerprint</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="mx-6 mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Standard Form */}
      <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="email"
              required
              autoFocus
              placeholder="vivek@bhashyamramakrishna.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Biometric Option */}
        {biometricSupported && (
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-0.5">
            <input
              type="checkbox"
              checked={enableBiometricOnLogin}
              onChange={(e) => setEnableBiometricOnLogin(e.target.checked)}
              className="rounded text-amber-500 focus:ring-amber-500 h-4 w-4"
            />
            <span className="font-medium">Enable Face ID / Fingerprint on this device</span>
          </label>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-slate-400 text-center mt-2">
          Authorized staff access only.
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 py-12 px-4 flex items-center justify-center">
      <Suspense fallback={<div className="text-slate-500 text-xs">Loading authentication...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
