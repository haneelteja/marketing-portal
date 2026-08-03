import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { PlatformMobileSidebar } from '@/components/PlatformMobileSidebar';

const NAV = [
  { href: '/platform',             label: 'Clients'           },
  { href: '/platform/pipeline',    label: 'Pipeline'          },
  { href: '/platform/connections', label: 'Connection health' },
  { href: '/platform/quotas',      label: 'Quota usage'       },
  { href: '/platform/editions',    label: 'Editions'          },
  { href: '/platform/audit',       label: 'Audit log'         },
];

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.claims.platform_role) redirect('/login?next=/platform');

  return (
    <div className="flex min-h-screen" style={{ background: '#F8FAFC' }}>
      <PlatformMobileSidebar nav={NAV} userLabel={session.claims.platform_role!} />
      <main className="flex-1 min-w-0 p-8 pt-16 md:pt-8">{children}</main>
    </div>
  );
}
