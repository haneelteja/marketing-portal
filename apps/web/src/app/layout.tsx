import type { ReactNode } from 'react';
import { loadTheme, themeToCssVars } from '@/lib/theme/loadTheme';
import './globals.css';

/** Root layout: theme resolved server-side before first paint (spec §7). */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await loadTheme();
  return (
    <html lang="en" style={themeToCssVars(theme) as React.CSSProperties}
          data-theme-version={theme.version}>
      <body className="bg-[var(--brand-surface)] text-[var(--brand-ink)] antialiased">
        {children}
      </body>
    </html>
  );
}
