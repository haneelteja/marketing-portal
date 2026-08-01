import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { ModelSettingsClient } from './ModelSettingsClient';

export const dynamic = 'force-dynamic';

export default async function ModelSettingsPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}/settings/models`);
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--brand-ink)]">AI model preferences</h1>
      <p className="mb-6 text-sm text-black/50">
        Choose which AI model to use for each generation type. Changes apply to your workspace immediately.
        Providers marked &ldquo;Needs API key&rdquo; require a platform admin to add the credentials.
      </p>
      <ModelSettingsClient />
    </div>
  );
}
