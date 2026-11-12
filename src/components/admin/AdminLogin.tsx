'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Lock } from 'lucide-react';

interface AdminLoginProps {
  authMode: 'supabase' | 'local';
  onSuccess: () => void;
}

export function AdminLogin({ authMode, onSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error || 'Login failed.');
        return;
      }
      onSuccess();
    } catch {
      setError('Network error during sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-base bg-hud flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-brand-surface border border-brand-border p-6 sm:p-8 shadow-elevated space-y-5">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/" className="text-xs font-semibold text-brand-accent hover:underline">
            &larr; Storefront
          </Link>
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-lavender text-brand-glow px-3 py-1 text-xs font-bold mb-2">
            <Lock className="w-3.5 h-3.5" /> Admin Portal ({authMode === 'supabase' ? 'Supabase Auth' : 'Local Session'})
          </div>
          <h1 className="font-display text-2xl font-bold text-brand-glow">GAMING STATION Admin</h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-1">
            Sign in with your administrator credentials configured on the server.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="adminEmail" className="block text-xs font-semibold text-brand-dark mb-1">
              Admin Email
            </label>
            <input
              id="adminEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@gamezone.local"
              className="w-full rounded-xl border border-brand-border px-3.5 py-3 text-sm focus:outline-none focus:border-brand-accent"
            />
          </div>

          <div>
            <label htmlFor="adminPass" className="block text-xs font-semibold text-brand-dark mb-1">
              Password
            </label>
            <input
              id="adminPass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full rounded-xl border border-brand-border px-3.5 py-3 text-sm focus:outline-none focus:border-brand-accent"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-primary hover:bg-brand-hover disabled:opacity-60 text-white font-bold py-3.5 text-sm shadow-card tap-target"
          >
            {loading ? 'Signing in...' : 'Sign In to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

