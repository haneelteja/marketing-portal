import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { encryptToken } from '@platform/core/crypto/tokenVault';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

interface TokenExchangeConfig {
  tokenUrl: string;
  clientId: string;
  secret: string;
}

const TOKEN_CONFIGS: Record<string, TokenExchangeConfig> = {
  instagram: {
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    clientId: process.env.META_APP_ID ?? '',
    secret: process.env.META_APP_SECRET ?? '',
  },
  facebook: {
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    clientId: process.env.META_APP_ID ?? '',
    secret: process.env.META_APP_SECRET ?? '',
  },
  youtube: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
  },
  linkedin: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientId: process.env.LINKEDIN_CLIENT_ID ?? '',
    secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
  },
};

function platformHost(): string {
  const h = process.env.NEXT_PUBLIC_PLATFORM_HOST ?? '';
  return h.startsWith('http') ? h : `https://${h}`;
}

async function exchangeCode(
  platform: string,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const cfg = TOKEN_CONFIGS[platform];
  if (!cfg) throw new Error(`Unknown platform: ${platform}`);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.secret,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  const data = await res.json() as Record<string, string>;
  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? 'Token exchange failed');
  }
  return data as unknown as TokenResponse;
}

async function getExternalAccountId(
  platform: string,
  accessToken: string,
): Promise<string> {
  if (platform === 'instagram' || platform === 'facebook') {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${accessToken}`,
    );
    const data = await res.json() as { id?: string };
    return data.id ?? 'unknown';
  }

  if (platform === 'youtube') {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = await res.json() as { items?: Array<{ id: string }> };
    return data.items?.[0]?.id ?? 'unknown';
  }

  if (platform === 'linkedin') {
    const res = await fetch(
      'https://api.linkedin.com/v2/organizations?q=roleAssignee',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = await res.json() as { elements?: Array<{ id: string }> };
    return data.elements?.[0]?.id ?? 'unknown';
  }

  return 'unknown';
}

/** SERVICE-ROLE JUSTIFICATION: OAuth callback — user session cookie may differ from
 *  the cookie-stored client_id that was set before the redirect. Slug lookup is
 *  read-only on a single clients row identified by the verified client_id. */
async function getSlugForClient(clientId: string): Promise<string> {
  const { serviceClient } = await import('@/lib/db/clients');
  const db = serviceClient();
  const { data } = await db
    .from('clients')
    .select('slug')
    .eq('id', clientId)
    .maybeSingle();
  return (data as { slug: string } | null)?.slug ?? '';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const { searchParams } = new URL(req.url);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = req.cookies.get('oauth_state')?.value;
  const storedClientId = req.cookies.get('oauth_client_id')?.value;
  const storedPlatform = req.cookies.get('oauth_platform')?.value;

  if (!code || state !== storedState || storedPlatform !== platform) {
    return new NextResponse('OAuth state mismatch or missing code', { status: 400 });
  }

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  const clientId = storedClientId || session.claims.client_id;
  if (!clientId) return new NextResponse('No client context', { status: 400 });

  const redirectUri = `${platformHost()}/api/social/callback/${platform}`;

  try {
    const tokens = await exchangeCode(platform, code, redirectUri);
    const externalId = await getExternalAccountId(platform, tokens.access_token);

    const db = rlsClient(session.accessToken);
    const { data: userRow } = await db
      .from('users')
      .select('id')
      .eq('auth_id', session.claims.sub)
      .maybeSingle();

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await db.from('social_accounts').upsert(
      {
        client_id: clientId,
        platform,
        external_account_id: externalId,
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token
          ? encryptToken(tokens.refresh_token)
          : null,
        token_expires_at: expiresAt,
        scopes_granted: (tokens.scope ?? '').split(/[, ]+/).filter(Boolean),
        connected_by: (userRow as { id: string } | null)?.id ?? null,
        status: 'connected',
      },
      { onConflict: 'client_id,platform,external_account_id' },
    );

    const slug = await getSlugForClient(clientId);
    const destination = slug
      ? new URL(`/app/${slug}/connections`, req.url)
      : new URL('/app', req.url);

    const res = NextResponse.redirect(destination);
    res.cookies.delete('oauth_state');
    res.cookies.delete('oauth_platform');
    res.cookies.delete('oauth_client_id');
    return res;
  } catch (err) {
    console.error('[oauth callback]', err);
    return new NextResponse(`OAuth failed: ${(err as Error).message}`, { status: 500 });
  }
}
