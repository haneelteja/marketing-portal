'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#00C4A0';
    e.target.style.boxShadow   = '0 0 0 3px rgba(0,196,160,0.12)';
  };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#E2E8F0';
    e.target.style.boxShadow   = 'none';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ── Left brand panel ────────────────────────────────────────── */}
      <div
        className="hidden lg:flex"
        style={{
          width: '480px',
          flexShrink: 0,
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px',
          background: 'linear-gradient(145deg, #0D1B2A 0%, #1B2A41 65%, #0A2240 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative rings */}
        {[
          { top: -120, right: -120, size: 440 },
          { top: -40,  right: -40,  size: 220 },
          { bottom: 60, left: -100, size: 360 },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            ...(s.top    !== undefined ? { top:    s.top    } : {}),
            ...(s.bottom !== undefined ? { bottom: s.bottom } : {}),
            ...(s.right  !== undefined ? { right:  s.right  } : {}),
            ...(s.left   !== undefined ? { left:   s.left   } : {}),
            width: s.size, height: s.size, borderRadius: '50%',
            border: `1px solid rgba(0,196,160,${0.07 - i * 0.02})`,
            pointerEvents: 'none',
          }} />
        ))}

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '72px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '8px',
              background: '#00C4A0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M8 3v10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: '16px', color: 'white', letterSpacing: '-0.015em' }}>
              Mintage Platform
            </span>
          </div>

          <h1 style={{
            fontSize: '38px', fontWeight: 800, lineHeight: 1.1,
            letterSpacing: '-0.03em', color: 'white',
            marginBottom: '20px', textWrap: 'balance',
          } as React.CSSProperties}>
            Your marketing<br />command centre.
          </h1>
          <p style={{ fontSize: '15px', lineHeight: 1.65, color: 'rgba(255,255,255,0.5)', maxWidth: '340px' }}>
            Create, approve, schedule, and analyse content across all your clients from one powerful workspace.
          </p>
        </div>

        {/* Stats grid */}
        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px 24px' }}>
          {[
            { value: '98%', label: 'Client retention' },
            { value: '4×',  label: 'Faster approvals' },
            { value: '60+', label: 'Integrations'     },
            { value: '24/7', label: 'Always on'       },
          ].map(s => (
            <div key={s.label}>
              <p style={{ fontSize: '30px', fontWeight: 700, color: '#00C4A0', letterSpacing: '-0.025em', lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', marginTop: '5px', letterSpacing: '0.02em' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F8FAFC', padding: '32px',
      }}>
        <div style={{
          width: '100%', maxWidth: '400px',
          background: 'white', borderRadius: '16px', padding: '44px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.07)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}>
          {/* Mobile wordmark */}
          <div className="flex items-center gap-2 mb-9 lg:hidden">
            <div style={{
              width: '28px', height: '28px', borderRadius: '7px',
              background: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M8 3v10" stroke="#00C4A0" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#0D1B2A', letterSpacing: '-0.01em' }}>
              Mintage Platform
            </span>
          </div>

          <h2 style={{
            fontSize: '22px', fontWeight: 700, color: '#0D1B2A',
            letterSpacing: '-0.02em', marginBottom: '6px',
          }}>
            Welcome back
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '32px', lineHeight: 1.5 }}>
            Sign in to access your workspace.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 600,
                color: '#374151', marginBottom: '7px',
                letterSpacing: '0.07em', textTransform: 'uppercase',
              }}>
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@agency.com"
                autoComplete="email"
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
                display: 'block', fontSize: '11px', fontWeight: 600,
                color: '#374151', marginBottom: '7px',
                letterSpacing: '0.07em', textTransform: 'uppercase',
              }}>
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
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
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>
            No account?{' '}
            <a href="/signup" style={{ color: '#00C4A0', fontWeight: 600, textDecoration: 'none' }}>
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
