import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { loadTheme } from '@/lib/theme/loadTheme';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { MobileSidebar } from '@/components/MobileSidebar';

const NAV = [
  { href: '', label: 'Overview' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/generate', label: 'Generate' },       // the four-stage generation tab (§6.2)
  { href: '/calendar', label: 'Calendar' },
  { href: '/connections', label: 'Connections' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/brand', label: 'Brand' },
  { href: '/team', label: 'Team' },
  { href: '/settings/models', label: 'Model settings' },
];

/** Client Console shell — themed from the tenant's tokens, never the agency's (spec §7). */
export default async function ClientConsoleLayout({ children, params }: {
  children: ReactNode; params: Promise<{ clientSlug: string }>;
}) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}`);
  const theme = await loadTheme();

  return (
    <div className="min-h-screen">
      {session.claims.impersonating && (
        <ImpersonationBanner clientName={theme.clientName}
                             expiresAt={session.claims.impersonation_expires_at!} />
      )}
      <div className="flex">
        {/*
          MobileSidebar is a client component that handles the hamburger toggle on mobile.
          On desktop (>= md) it renders as a normal static sidebar.
        */}
        <MobileSidebar>
          <div className="mb-6 flex items-center gap-3">
            {theme.logoUrl
              ? <img src={theme.logoUrl} alt="" className="h-8 w-8 rounded-[var(--brand-radius)] object-contain" />
              : <div className="h-8 w-8 rounded-[var(--brand-radius)] bg-[var(--brand-primary)]" />}
            <span className="font-semibold text-[var(--brand-primary)]">{theme.clientName}</span>
          </div>
          <nav aria-label="Workspace">
            {NAV.map((item) => (
              <a key={item.href} href={`/app/${clientSlug}${item.href}`}
                 className="block rounded-[var(--brand-radius)] px-3 py-2 text-sm hover:bg-[var(--brand-primary)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-accent)]">
                {item.label}
              </a>
            ))}
          </nav>
        </MobileSidebar>

        {/* On mobile, add top padding so content clears the hamburger button */}
        <main className="flex-1 p-8 pt-16 md:pt-8">{children}</main>
      </div>
    </div>
  );
}
