'use client';

/**
 * Persistent banner whenever the session carries the impersonation claim (spec §5.1):
 * impersonation is never silent. Fixed, high-contrast, uncloseable; shows expiry and
 * a one-click end action (which ends the session server-side and is audit-logged).
 */
export function ImpersonationBanner({ clientName, expiresAt }: {
  clientName: string; expiresAt: string;
}) {
  return (
    <div role="alert"
         className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-500 px-4 py-2 text-sm font-medium text-black">
      <span>
        Support mode: you are viewing <strong>{clientName}</strong> as an impersonated admin.
        Ends {new Date(expiresAt).toLocaleTimeString()}.
      </span>
      <form action="/api/impersonation/end" method="post">
        <button className="rounded-[var(--brand-radius)] border border-black/30 px-3 py-1 hover:bg-black/10">
          End session
        </button>
      </form>
    </div>
  );
}
