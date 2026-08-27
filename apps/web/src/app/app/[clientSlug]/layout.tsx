import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { loadTheme } from '@/lib/theme/loadTheme';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { MobileSidebar } from '@/components/MobileSidebar';

const NAV = [
  { href: '',               label: 'Overview'       },
  { href: '/campaigns',     label: 'Campaigns'      },
  { href: '/generate',      label: 'Generate'       },
  { href: '/calendar',      label: 'Calendar'       },
  { href: '/connections',   label: 'Connections'    },
  { href: '/analytics',     label: 'Analytics'      },
  { href: '/brand',         label: 'Brand'          },
  { href: '/products',      label: 'Products'       },
  { href: '/media',         label: 'Media'          },
  { href: '/team',          label: 'Team'           },
  { href: '/settings/models', label: 'Model settings' },
];

export default async function ClientConsoleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}`);
  const theme = await loadTheme();

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {session.claims.impersonating && (
        <ImpersonationBanner clientName={theme.clientName} expiresAt={session.claims.impersonation_expires_at!} />
      )}
      <div className="flex">
        <MobileSidebar>
          {/* Client brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px', padding: '4px 8px' }}>
            {theme.logoUrl ? (
              <img
                src={theme.logoUrl}
                alt=""
                style={{ width: '30px', height: '30px', borderRadius: '7px', objectFit: 'contain', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0,
                background: 'var(--brand-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 700 }}>
                  {theme.clientName?.charAt(0).toUpperCase() ?? 'C'}
                </span>
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontWeight: 700, fontSize: '13px', color: '#0D1B2A',
                letterSpacing: '-0.01em', lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {theme.clientName}
              </div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px', letterSpacing: '0.04em' }}>
                Workspace
              </div>
            </div>
          </div>

          {/* Section label */}
          <div style={{
            fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#CBD5E1',
            paddingLeft: '12px', marginBottom: '6px',
          }}>
            Navigation
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {NAV.map(item => (
              <a
                key={item.href}
                href={`/app/${clientSlug}${item.href}`}
                style={{
                  display: 'block', padding: '8px 12px', borderRadius: '7px',
                  fontSize: '13.5px', color: '#475569', textDecoration: 'none',
                  transition: 'background 0.12s, color 0.12s',
                }}
                className="hover:bg-[#F1F5F9] hover:text-[#0D1B2A]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Divider + back */}
          <div style={{ height: '1px', background: '#F1F5F9', margin: '14px 4px' }} />
          <a
            href="/platform"
            style={{
              display: 'block', padding: '8px 12px', borderRadius: '7px',
              fontSize: '12px', color: '#94A3B8', textDecoration: 'none',
            }}
          >
            ← All clients
          </a>
        </MobileSidebar>

        <main className="flex-1 min-w-0 p-8 pt-16 md:pt-8">{children}</main>
      </div>
    </div>
  );
}
