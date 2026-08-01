import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { PlatformMobileSidebar } from '@/components/PlatformMobileSidebar';

const NAV = [
  { href: '/platform', label: 'Clients' },
  { href: '/platform/pipeline', label: 'Pipeline' },       // cross-client oversight (§5.3)
  { href: '/platform/connections', label: 'Connection health' },
  { href: '/platform/quotas', label: 'Quota usage' },
  { href: '/platform/editions', label: 'Editions' },
  { href: '/platform/audit', label: 'Audit log' },
];

/** Platform Console shell — agency branding, cross-tenant scope, platform roles only. */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.claims.platform_role) redirect('/login?next=/platform');

  return (
    <div className="flex min-h-screen">
      {/*
        PlatformMobileSidebar is a client component handling mobile hamburger toggle.
        On desktop (>= md) it renders as a normal static sidebar.
      */}
      <PlatformMobileSidebar>
        <span className="mb-6 text-sm font-semibold uppercase tracking-widest opacity-80">
          Platform Console
        </span>
        <nav aria-label="Platform">
          {NAV.map((i) => (
            <a key={i.href} href={i.href}
               className="block rounded-[var(--brand-radius)] px-3 py-2 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-accent)]">
              {i.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto text-xs opacity-60">
          Signed in as {session.claims.platform_role}
        </div>
      </PlatformMobileSidebar>

      {/* On mobile, add top padding so content clears the hamburger button */}
      <main className="flex-1 p-8 pt-16 md:pt-8">{children}</main>
    </div>
  );
}
