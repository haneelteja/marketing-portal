'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

interface NavItem { href: string; label: string; }

interface Props {
  nav: NavItem[];
  userLabel: string;
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 4px 0' }}>
      <div style={{
        width: '30px', height: '30px', borderRadius: '7px',
        background: '#00C4A0', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10M8 3v10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '13px', color: 'white', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
          Mintage
        </div>
        <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.32)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '1px' }}>
          Platform
        </div>
      </div>
    </div>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = item.href === '/platform'
    ? pathname === '/platform'
    : pathname.startsWith(item.href);

  return (
    <a
      href={item.href}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '8px 12px', borderRadius: '7px',
        fontSize: '13.5px', fontWeight: isActive ? 600 : 400,
        color: isActive ? '#00C4A0' : 'rgba(255,255,255,0.58)',
        background: isActive ? 'rgba(0,196,160,0.1)' : 'transparent',
        textDecoration: 'none',
        transition: 'background 0.12s, color 0.12s',
        letterSpacing: isActive ? '-0.01em' : '0',
        borderLeft: isActive ? '2px solid #00C4A0' : '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.background = 'rgba(255,255,255,0.05)';
          el.style.color = 'rgba(255,255,255,0.88)';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.background = 'transparent';
          el.style.color = 'rgba(255,255,255,0.58)';
        }
      }}
    >
      {item.label}
    </a>
  );
}

function SidebarContent({ nav, userLabel, onClose }: Props & { onClose?: () => void }) {
  const pathname = usePathname();
  const initials = userLabel.charAt(0).toUpperCase();

  return (
    <aside style={{
      width: '228px', minHeight: '100vh',
      background: '#0D1B2A',
      display: 'flex', flexDirection: 'column',
      padding: '22px 14px',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      boxSizing: 'border-box',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Close — mobile only */}
      {onClose && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          style={{
            alignSelf: 'flex-end', marginBottom: '8px', marginRight: '2px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.35)', fontSize: '15px', padding: '4px',
          }}
        >
          ✕
        </button>
      )}

      {/* Logo */}
      <div style={{ marginBottom: '32px' }}>
        <Logo />
      </div>

      {/* Section label */}
      <div style={{
        fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)',
        paddingLeft: '12px', marginBottom: '6px',
      }}>
        Console
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {nav.map(item => <NavLink key={item.href} item={item} pathname={pathname} />)}
      </nav>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '16px 4px' }} />

      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 10px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
          background: 'rgba(0,196,160,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700, color: '#00C4A0',
        }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.78)',
            textTransform: 'capitalize', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {userLabel.replace('_', ' ')}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>
            Platform admin
          </div>
        </div>
      </div>
    </aside>
  );
}

export function PlatformMobileSidebar({ nav, userLabel }: Props) {
  const [open, setOpen] = useState(false);

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
          background: '#0D1B2A', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '5px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        {[0, 1, 2].map(i => (
          <span key={i} style={{ display: 'block', width: '18px', height: '1.5px', background: 'white', borderRadius: '2px' }} />
        ))}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile overlay */}
      <div
        className="fixed inset-y-0 left-0 z-50 md:hidden"
        style={{
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
        }}
      >
        <SidebarContent nav={nav} userLabel={userLabel} onClose={() => setOpen(false)} />
      </div>

      {/* Desktop static sidebar */}
      <div className="hidden md:block" style={{ flexShrink: 0 }}>
        <SidebarContent nav={nav} userLabel={userLabel} />
      </div>
    </>
  );
}
