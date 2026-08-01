'use client';

import { useState, type ReactNode } from 'react';

interface MobileSidebarProps {
  /** The full sidebar content (logo block + nav + footer). */
  children: ReactNode;
}

/**
 * Wraps sidebar content with mobile-responsive behaviour:
 *  - Mobile (< md): hidden by default, hamburger button reveals it as a fixed overlay.
 *  - Desktop (>= md): renders inline as a normal sidebar (no overlay).
 */
export function MobileSidebar({ children }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger button — only visible on mobile */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-[var(--brand-radius)] border border-black/10 bg-white shadow-sm md:hidden"
      >
        {/* Three-line icon */}
        <span className="flex flex-col gap-1.5 p-1">
          <span className="block h-0.5 w-5 rounded-full bg-[var(--brand-ink)]" />
          <span className="block h-0.5 w-5 rounded-full bg-[var(--brand-ink)]" />
          <span className="block h-0.5 w-5 rounded-full bg-[var(--brand-ink)]" />
        </span>
      </button>

      {/* Backdrop — mobile only, shown when sidebar is open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/*
        Sidebar panel:
        - Mobile: fixed overlay, slides in from left when open, hidden otherwise.
        - Desktop: static, always visible (override the mobile translate via md:translate-x-0 md:static).
      */}
      <aside
        className={[
          // Shared styles
          'flex min-h-screen w-60 flex-col gap-1 border-r border-black/10 bg-white/60 p-4',
          // Mobile: fixed overlay
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: reset to normal flow
          'md:static md:translate-x-0 md:transition-none',
        ].join(' ')}
      >
        {/* Close button — mobile only */}
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="mb-2 self-end rounded-[var(--brand-radius)] px-2 py-1 text-xs text-black/50 hover:bg-black/5 md:hidden"
        >
          Close ✕
        </button>

        {children}
      </aside>
    </>
  );
}
