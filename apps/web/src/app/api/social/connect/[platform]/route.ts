import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';

const OAUTH_CONFIGS = {
  instagram: {
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
    clientId: () => process.env.META_APP_ID!,
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    scope: 'pages_show_list,pages_manage_posts,pages_read_engagement',
    clientId: () => process.env.META_APP_ID!,
  },
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope:
      'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    clientId: () => process.env.GOOGLE_OAUTH_CLIENT_ID!,
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    scope: 'w_organization_social r_organization_social',
    clientId: () => process.env.LINKEDIN_CLIENT_ID!,
  },
} as const;

type Platform = keyof typeof OAUTH_CONFIGS;

function platformHost(): string {
  const h = process.env.NEXT_PUBLIC_PLATFORM_HOST ?? '';
  return h.startsWith('http') ? h : `https://${h}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  const { platform } = await params;

  if (!(platform in OAUTH_CONFIGS)) {
    return new NextResponse(`${platform} is not yet implemented`, { status: 400 });
  }

  const config = OAUTH_CONFIGS[platform as Platform];
  const state = crypto.randomUUID();
  const redirectUri = `${platformHost()}/api/social/callback/${platform}`;

  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set('client_id', config.clientId());
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', config.scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');

  // YouTube requires offline access for refresh tokens
  if (platform === 'youtube') {
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
  }

  const res = NextResponse.redirect(authUrl.toString());
  const cookieOpts = { httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: 600 };
  res.cookies.set('oauth_state', state, cookieOpts);
  res.cookies.set('oauth_platform', platform, cookieOpts);
  res.cookies.set('oauth_client_id', session.claims.client_id ?? '', cookieOpts);
  return res;
}
