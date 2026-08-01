import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({ params, searchParams }: {
  params: Promise<{ clientSlug: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await getSession();
  const { clientSlug } = await params;
  const { week = '0' } = await searchParams;
  if (!session) redirect(`/login?next=/app/${clientSlug}/calendar`);

  const offset = parseInt(week) * 7;
  const start = new Date(Date.now() + offset * 86400000);
  start.setHours(0, 0, 0, 0);
  // Align to Monday
  const dayOfWeek = start.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + diff);
  const end = new Date(start.getTime() + 7 * 86400000);

  const db = rlsClient(session.accessToken);
  const { data: posts } = await db
    .from('scheduled_posts')
    .select('id, platform, caption, scheduled_at, status, concept_assets(source_url)')
    .gte('scheduled_at', start.toISOString())
    .lt('scheduled_at', end.toISOString())
    .order('scheduled_at');

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() + i * 86400000);
    return d;
  });

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    published: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    publishing: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  const weekNum = parseInt(week);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--brand-ink)]">Content Calendar</h1>
        <div className="flex gap-2">
          <a href={`?week=${weekNum - 1}`}
             className="rounded-[var(--brand-radius)] border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5">← Prev</a>
          <a href={`?week=0`}
             className="rounded-[var(--brand-radius)] border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5">Today</a>
          <a href={`?week=${weekNum + 1}`}
             className="rounded-[var(--brand-radius)] border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5">Next →</a>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[var(--brand-radius)] border border-black/10 bg-black/10">
        {days.map(day => {
          const dayStr = day.toISOString().split('T')[0];
          const dayPosts = (posts ?? []).filter(p => p.scheduled_at.startsWith(dayStr));
          const isToday = dayStr === new Date().toISOString().split('T')[0];
          return (
            <div key={dayStr} className="min-h-[160px] bg-white p-2">
              <p className={`mb-2 text-xs font-semibold ${isToday ? 'text-[var(--brand-primary)]' : 'text-black/40'}`}>
                {day.toLocaleDateString('en', { weekday: 'short', day: 'numeric' })}
              </p>
              <div className="flex flex-col gap-1">
                {dayPosts.map(post => (
                  <div key={post.id} className="rounded-md bg-black/5 p-1.5">
                    <p className="text-xs font-medium capitalize">{post.platform}</p>
                    {post.caption && <p className="text-xs text-black/50 truncate">{post.caption.slice(0, 40)}</p>}
                    <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusColors[post.status] ?? 'bg-gray-100'}`}>
                      {post.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
