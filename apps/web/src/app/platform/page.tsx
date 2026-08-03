import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { platformClient } from '@/lib/db/clients';
import { NewClientButton } from './NewClientButton';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  active:    { bg: 'rgba(16,185,129,0.08)',  color: '#059669', dot: '#10B981' },
  suspended: { bg: 'rgba(245,158,11,0.1)',   color: '#B45309', dot: '#F59E0B' },
  archived:  { bg: 'rgba(100,116,139,0.08)', color: '#64748B', dot: '#94A3B8' },
};

export default async function PlatformClientsPage() {
  const session = await getSession();
  if (!session?.claims.platform_role) redirect('/login?next=/platform');

  const db = platformClient(session.accessToken);
  const { data: clients } = await db
    .from('clients')
    .select('id, name, slug, status, created_at, client_editions(name)')
    .order('created_at', { ascending: false });

  const count = clients?.length ?? 0;

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0D1B2A', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Clients
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B' }}>
            {count === 0 ? 'No workspaces yet' : `${count} workspace${count !== 1 ? 's' : ''}`}
          </p>
        </div>
        <NewClientButton />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block" style={{
        background: 'white', borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
              {['Name', 'Slug', 'Edition', 'Status', 'Created', ''].map(h => (
                <th key={h} style={{
                  padding: '11px 16px', textAlign: 'left',
                  fontSize: '11px', fontWeight: 600,
                  color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c, idx) => {
              const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.archived;
              return (
                <tr key={c.id} style={{
                  borderBottom: idx < (clients?.length ?? 1) - 1 ? '1px solid #F8FAFC' : 'none',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0D1B2A' }}>
                    {c.name}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <code style={{
                      fontSize: '12px', color: '#64748B',
                      background: '#F1F5F9', padding: '2px 7px', borderRadius: '4px',
                      fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                    }}>
                      {c.slug}
                    </code>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#475569' }}>
                    {(c.client_editions as unknown as { name: string } | null)?.name ?? (
                      <span style={{ color: '#CBD5E1' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 10px', borderRadius: '20px',
                      fontSize: '11.5px', fontWeight: 500,
                      background: st.bg, color: st.color,
                    }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#94A3B8', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <a
                      href={`/app/${c.slug}`}
                      style={{
                        display: 'inline-block', padding: '6px 14px', borderRadius: '6px',
                        fontSize: '12px', fontWeight: 600, textDecoration: 'none',
                        color: '#0D1B2A', border: '1px solid #E2E8F0',
                        background: 'white', transition: 'border-color 0.12s, background 0.12s',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLAnchorElement;
                        el.style.borderColor = '#00C4A0';
                        el.style.color = '#00C4A0';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLAnchorElement;
                        el.style.borderColor = '#E2E8F0';
                        el.style.color = '#0D1B2A';
                      }}
                    >
                      Open →
                    </a>
                  </td>
                </tr>
              );
            })}
            {!clients?.length && (
              <tr>
                <td colSpan={6} style={{ padding: '56px 16px', textAlign: 'center' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '10px',
                    background: '#F1F5F9', margin: '0 auto 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#CBD5E1" strokeWidth="1.5"/>
                      <path d="M12 8v8M8 12h8" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#94A3B8', marginBottom: '4px' }}>No clients yet</p>
                  <p style={{ fontSize: '13px', color: '#CBD5E1' }}>Create a workspace to get started.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {(clients ?? []).map(c => {
          const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.archived;
          return (
            <div key={c.id} style={{
              background: 'white', borderRadius: '10px', padding: '16px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: '14px', color: '#0D1B2A', marginBottom: '4px' }}>{c.name}</p>
                  <code style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>{c.slug}</code>
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '3px 9px', borderRadius: '20px', flexShrink: 0,
                  fontSize: '11px', fontWeight: 500,
                  background: st.bg, color: st.color,
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: st.dot }} />
                  {c.status}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                  {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <a
                  href={`/app/${c.slug}`}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', fontSize: '12px',
                    fontWeight: 600, textDecoration: 'none', color: '#0D1B2A',
                    border: '1px solid #E2E8F0', background: 'white',
                  }}
                >
                  Open →
                </a>
              </div>
            </div>
          );
        })}
        {!clients?.length && (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#94A3B8' }}>No clients yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
