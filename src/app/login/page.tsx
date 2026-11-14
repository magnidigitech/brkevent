'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Lock, Mail, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/scanner';

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent, devRole?: 'admin' | 'scanner') => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || (devRole === 'admin' ? 'admin@bhashyamramakrishna.in' : 'scanner1@bhashyamramakrishna.in'),
          password: password || 'Secure2026!',
          devRole,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed. Please check credentials.');
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
    <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-xl mx-auto flex items-center justify-center mb-3 shadow-md">
          BRK
        </div>
        <h1 className="text-xl font-black tracking-tight">Staff Authentication</h1>
        <p className="text-xs text-slate-400 mt-1">
          Bhashyam Ramakrishna Event Operations
        </p>
      </div>

      {/* Return URL Notice */}
      {returnUrl !== '/scanner' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          <span>You will be returned to <strong>{returnUrl}</strong> upon sign-in.</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={(e) => handleSubmit(e)} className="p-6 flex flex-col gap-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Staff Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="email"
              required
              placeholder="staff@bhashyamramakrishna.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow transition flex items-center justify-center gap-2 disabled:opacity-50"
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

        {/* Security Notice */}
        <p className="text-[11px] text-slate-500 text-center mt-2">
          Public self-registration is disabled. Contact your event coordinator to obtain or reset staff credentials.
        </p>

        {/* Local Dev / Quick Testing Options */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
            Quick Local Sign-In (Testing)
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={(e) => handleSubmit(e, 'admin')}
              className="py-2 px-3 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition text-center"
            >
              Sign In as Admin
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, 'scanner')}
              className="py-2 px-3 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition text-center"
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
    <div className="flex-1 py-12 px-4 flex items-center justify-center">
      <Suspense fallback={<div className="text-slate-500">Loading login form...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
