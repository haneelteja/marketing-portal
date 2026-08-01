'use client';

import { useState, type ReactNode } from 'react';

interface PlatformMobileSidebarProps {
  children: ReactNode;
}

/**
 * Mobile-responsive sidebar wrapper for the Platform Console.
 * Uses the dark brand-primary background consistent with the platform sidebar.
 *  - Mobile (< md): hamburger button; opens as fixed overlay.
 *  - Desktop (>= md): inline sidebar.
 */
export function PlatformMobileSidebar({ children }: PlatformMobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-[var(--brand-radius)] bg-[var(--brand-primary)] shadow-sm md:hidden"
      >
        <span className="flex flex-col gap-1.5 p-1">
          <span className="block h-0.5 w-5 rounded-full bg-white" />
          <span className="block h-0.5 w-5 rounded-full bg-white" />
          <span className="block h-0.5 w-5 rounded-full bg-white" />
        </span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/*
        Sidebar panel:
        - Mobile: fixed overlay with dark background.
        - Desktop: static, always visible.
      */}
      <aside
        className={[
          'flex w-60 flex-col border-r border-black/10 bg-[var(--brand-primary)] p-4 text-white',
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          'md:static md:translate-x-0 md:transition-none md:min-h-screen',
        ].join(' ')}
      >
        {/* Close button — mobile only */}
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="mb-2 self-end rounded-[var(--brand-radius)] px-2 py-1 text-xs text-white/60 hover:bg-white/10 md:hidden"
        >
          Close ✕
        </button>

        {children}
      </aside>
    </>
  );
}
