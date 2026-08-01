'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F6F2]">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mx-auto">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold text-[#1B2A41]">Check your email</h1>
          <p className="text-sm text-black/60">
            We sent a confirmation link to <span className="font-medium text-[#1B2A41]">{email}</span>. Click it to activate your account.
          </p>
          <a href="/login" className="mt-6 inline-block text-sm text-[#1B2A41] underline">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F6F2]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold text-[#1B2A41]">Create account</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1B2A41]">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B2A41]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1B2A41]">
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B2A41]"
            />
            <span className="text-xs text-black/40">Minimum 8 characters</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#1B2A41] py-2 text-sm font-semibold text-white hover:bg-[#2a3f5e] disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-black/50">
          Already have an account?{' '}
          <a href="/login" className="text-[#1B2A41] underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
