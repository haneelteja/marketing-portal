'use client';

import { useState, type ReactNode } from 'react';

interface MobileSidebarProps {
  children: ReactNode;
}

export function MobileSidebar({ children }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  const sidebarClasses = [
    'flex flex-col min-h-screen w-[228px] flex-shrink-0',
    'fixed inset-y-0 left-0 z-50 transition-transform duration-200',
    open ? 'translate-x-0' : '-translate-x-full',
    'md:static md:translate-x-0 md:transition-none',
  ].join(' ');

  return (
    <>
      {/* Hamburger — mobile only */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 md:hidden"
        style={{
          width: '38px', height: '38px', borderRadius: '8px',
          background: 'white', border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '5px',
        }}
      >
        {[0, 1, 2].map(i => (
          <span key={i} style={{ display: 'block', width: '18px', height: '1.5px', background: '#0D1B2A', borderRadius: '2px' }} />
        ))}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(13,27,42,0.45)' }}
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={sidebarClasses}
        style={{
          background: 'white',
          borderRight: '1px solid #F1F5F9',
          padding: '22px 14px',
          boxShadow: '4px 0 24px rgba(0,0,0,0.04)',
          gap: '2px',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* Close — mobile only */}
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="mb-2 self-end md:hidden"
          style={{
            background: '#F1F5F9', border: 'none', cursor: 'pointer',
            width: '26px', height: '26px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#94A3B8', fontSize: '13px',
          }}
        >
          ✕
        </button>

        {children}
      </aside>
    </>
  );
}
