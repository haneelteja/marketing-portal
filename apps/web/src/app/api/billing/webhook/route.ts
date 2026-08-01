/**
 * Billing webhook receiver (spec §15: quota interface is the enforcement point;
 * payment processor sits behind it). This handler validates the webhook signature,
 * then updates the client_editions quota or suspends the client based on the event.
 *
 * Currently wired for Stripe. Set STRIPE_WEBHOOK_SECRET to enable; without it
 * every request returns 501 so the endpoint is visible but honest (spec §15.1).
 *
 * SERVICE-ROLE JUSTIFICATION: billing events arrive outside any user session.
 * The only writes performed are quota adjustments on client_editions and status
 * changes on clients — both keyed by IDs carried in the verified webhook payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/** Verify Stripe-Signature header using HMAC-SHA256 (Web Crypto, no stripe SDK needed). */
async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const timestamp = parts['t'];
  const sig = parts['v1'];
  if (!timestamp || !sig) return false;

  const signed = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  const computed = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return computed === sig;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Billing webhook not configured. Set STRIPE_WEBHOOK_SECRET.' },
      { status: 501 },
    );
  }

  const rawBody = await req.text();
  const sigHeader = req.headers.get('stripe-signature');

  const valid = await verifyStripeSignature(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = serviceClient();

  switch (event.type) {
    case 'invoice.paid': {
      // Renew quota on successful payment. Stripe metadata must carry client_id + quota_units.
      const meta = event.data.object['metadata'] as Record<string, string> | undefined;
      const clientId = meta?.['client_id'];
      const quotaUnits = Number(meta?.['quota_units'] ?? 0);
      if (!clientId || !quotaUnits) break;

      const { error } = await db
        .from('client_editions')
        .update({ ai_generation_quota: quotaUnits })
        .eq('id',
          // Resolve edition_id from client
          db.from('clients').select('edition_id').eq('id', clientId).single() as unknown as string,
        );
      if (!error) {
        await audit(db, 'billing.quota_renewed', { type: 'client', id: clientId }, { quotaUnits, event: event.type });
      }
      break;
    }

    case 'invoice.payment_failed':
    case 'customer.subscription.deleted': {
      // Suspend client on non-payment or cancellation.
      const meta = event.data.object['metadata'] as Record<string, string> | undefined;
      const clientId = meta?.['client_id'];
      if (!clientId) break;

      const { error } = await db
        .from('clients')
        .update({ status: 'suspended' })
        .eq('id', clientId);
      if (!error) {
        await audit(db, 'billing.client_suspended', { type: 'client', id: clientId }, { event: event.type });
      }
      break;
    }

    case 'customer.subscription.updated': {
      // Plan upgrade/downgrade — update edition_id based on Stripe price → edition mapping.
      // The price→edition mapping must be set in STRIPE_PRICE_EDITION_MAP env var as JSON.
      const priceEditionMap: Record<string, string> = JSON.parse(
        process.env.STRIPE_PRICE_EDITION_MAP ?? '{}',
      );
      const items = event.data.object['items'] as { data: Array<{ price: { id: string } }> } | undefined;
      const priceId = items?.data?.[0]?.price?.id;
      const editionId = priceId ? priceEditionMap[priceId] : undefined;
      const meta = event.data.object['metadata'] as Record<string, string> | undefined;
      const clientId = meta?.['client_id'];

      if (!clientId || !editionId) break;

      const { error } = await db
        .from('clients')
        .update({ edition_id: editionId })
        .eq('id', clientId);
      if (!error) {
        await audit(db, 'billing.plan_changed', { type: 'client', id: clientId }, { editionId, priceId, event: event.type });
      }
      break;
    }

    default:
      // Acknowledge unknown events — Stripe expects 2xx or it retries.
      break;
  }

  return NextResponse.json({ received: true });
}
