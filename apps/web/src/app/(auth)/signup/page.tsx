'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function SignupPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  }

  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#00C4A0';
    e.target.style.boxShadow   = '0 0 0 3px rgba(0,196,160,0.12)';
  };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#E2E8F0';
    e.target.style.boxShadow   = 'none';
  };

  if (done) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F8FAFC',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <div style={{
          width: '100%', maxWidth: '400px', background: 'white',
          borderRadius: '16px', padding: '48px 44px', textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.07)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'rgba(0,196,160,0.1)', margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#00C4A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0D1B2A', letterSpacing: '-0.02em', marginBottom: '10px' }}>
            Check your email
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6 }}>
            We sent a confirmation link to{' '}
            <span style={{ fontWeight: 600, color: '#0D1B2A' }}>{email}</span>.
            Click it to activate your account.
          </p>
          <a href="/login" style={{
            display: 'inline-block', marginTop: '28px', fontSize: '13px',
            color: '#00C4A0', fontWeight: 600, textDecoration: 'none',
          }}>
            ← Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F8FAFC', padding: '32px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', background: 'white',
        borderRadius: '16px', padding: '44px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.07)',
        border: '1px solid rgba(0,0,0,0.06)',
      }}>
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '36px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '7px', background: '#0D1B2A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M8 3v10" stroke="#00C4A0" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '14px', color: '#0D1B2A', letterSpacing: '-0.01em' }}>
            Mintage Platform
          </span>
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0D1B2A', letterSpacing: '-0.02em', marginBottom: '6px' }}>
          Create your account
        </h2>
        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '32px', lineHeight: 1.5 }}>
          Get access to the platform workspace.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{
              display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151',
              marginBottom: '7px', letterSpacing: '0.07em', textTransform: 'uppercase',
            }}>
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              autoComplete="email"
              onChange={e => setEmail(e.target.value)}
              placeholder="you@agency.com"
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px',
                color: '#0D1B2A', background: '#FAFBFC',
                border: '1px solid #E2E8F0', borderRadius: '8px',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>

          <div>
            <label style={{
              display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151',
              marginBottom: '7px', letterSpacing: '0.07em', textTransform: 'uppercase',
            }}>
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px',
                color: '#0D1B2A', background: '#FAFBFC',
                border: '1px solid #E2E8F0', borderRadius: '8px',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: '8px', fontSize: '13px',
              background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px', fontSize: '14px', fontWeight: 600,
              color: 'white', border: 'none', borderRadius: '8px',
              background: loading ? '#94A3B8' : '#0D1B2A',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em', marginTop: '2px',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Creating account…' : 'Create account →'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#00C4A0', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
