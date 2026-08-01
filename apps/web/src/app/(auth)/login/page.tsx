'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err || !data.session) {
      setError(err?.message ?? 'Login failed');
      setLoading(false);
      return;
    }
    const claims = JSON.parse(atob(data.session.access_token.split('.')[1]));
    if (claims.platform_role) {
      window.location.href = '/platform';
    } else if (claims.client_id) {
      window.location.href = `/app/${claims.client_slug ?? ''}`;
    } else {
      setError('Your account is not yet assigned to a workspace. Ask your platform admin to add you.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F6F2]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold text-[#1B2A41]">Sign in</h1>
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
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B2A41]"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#1B2A41] py-2 text-sm font-semibold text-white hover:bg-[#2a3f5e] disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-black/50">
          No account?{' '}
          <a href="/signup" className="text-[#1B2A41] underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
