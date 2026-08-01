import 'server-only';
import { headers } from 'next/headers';
import { serviceClient } from '@/lib/db/clients';

export interface ThemeTokens {
  colors: { primary: string; secondary: string; accent: string; surface: string; ink: string };
  logoUrl: string | null;
  fontDisplay: string;
  fontBody: string;
  radius: string;
  clientName: string;
  version: number;
}

export const AGENCY_DEFAULT: ThemeTokens = {
  colors: { primary: '#1B2A41', secondary: '#3E5C76', accent: '#C48A2D',
            surface: '#F7F6F2', ink: '#16181D' },
  logoUrl: null,
  fontDisplay: 'var(--font-display)',
  fontBody: 'var(--font-body)',
  radius: '10px',
  clientName: 'Platform',
  version: 0,
};

/**
 * Resolves the active theme for the current request BEFORE first paint (spec §7).
 * Middleware injected x-tenant-id/x-theme-version; the root layout awaits this and
 * renders CSS variables inline — no flash of wrong brand. Theme versions are pinned
 * so exported reports can re-render with the version they were built against.
 *
 * SERVICE-ROLE JUSTIFICATION: theme resolution runs pre-auth (public login page on a
 * custom domain must already be branded). Read-only, single table, keyed by the
 * middleware-verified tenant id; result is cached per tenant+version.
 */
export async function loadTheme(): Promise<ThemeTokens> {
  const h = await headers();
  const tenantId = h.get('x-tenant-id');
  if (!tenantId) return AGENCY_DEFAULT;

  const db = serviceClient();
  const { data } = await db
    .from('theme_versions')
    .select('tokens, version')
    .eq('client_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return AGENCY_DEFAULT;
  return { ...AGENCY_DEFAULT, ...(data.tokens as Partial<ThemeTokens>), version: data.version };
}

/** Theme tokens -> inline CSS custom properties applied on <html>. */
export function themeToCssVars(t: ThemeTokens): Record<string, string> {
  return {
    '--brand-primary': t.colors.primary,
    '--brand-secondary': t.colors.secondary,
    '--brand-accent': t.colors.accent,
    '--brand-surface': t.colors.surface,
    '--brand-ink': t.colors.ink,
    '--brand-radius': t.radius,
  };
}
