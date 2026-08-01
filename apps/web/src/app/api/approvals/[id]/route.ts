import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';
import { sendEmail } from '@platform/core/email/sender';
import { approvalDecidedEmail } from '@platform/core/email/templates';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'platform_admin'].includes(session.claims.client_role ?? session.claims.platform_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  const { id } = await params;
  const { status, comment } = await req.json();
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });
  }
  const db = rlsClient(session.accessToken);

  // Fetch the approval to find target info
  const { data: approval, error: fetchError } = await db
    .from('approvals')
    .select('id, target_type, target_id, status, requested_by')
    .eq('id', id)
    .single();
  if (fetchError || !approval) return NextResponse.json({ error: fetchError?.message ?? 'Not found' }, { status: 404 });
  if (approval.status !== 'pending') {
    return NextResponse.json({ error: 'Approval has already been decided' }, { status: 409 });
  }

  // Get user row for approved_by
  const { data: userRow } = await db.from('users').select('id').eq('auth_id', session.claims.sub).maybeSingle();

  // Update approval
  const { data, error } = await db
    .from('approvals')
    .update({
      status,
      comment: comment ?? null,
      approved_by: userRow?.id,
      decided_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Update target status based on decision
  if (approval.target_type === 'concept_asset') {
    await db
      .from('concept_assets')
      .update({ status: status === 'approved' ? 'approved' : 'rejected' })
      .eq('id', approval.target_id);
  } else if (approval.target_type === 'concept') {
    if (status === 'approved') {
      await db.from('concepts').update({ status: 'locked' }).eq('id', approval.target_id);
    } else {
      await db.from('concepts').update({ status: 'draft' }).eq('id', approval.target_id);
    }
  }

  await audit(db, `approval.${status}`, { type: approval.target_type, id: approval.target_id }, { comment });

  // Notify the requester of the approval decision
  const { data: requester } = await db
    .from('users')
    .select('email')
    .eq('id', approval.requested_by)
    .single();

  if (requester?.email) {
    const { subject, html } = approvalDecidedEmail({
      targetType: approval.target_type,
      targetName: approval.target_id,
      status,
      comment: comment ?? undefined,
      decidedBy: session.claims.email ?? session.claims.sub,
      workspaceUrl: process.env.NEXT_PUBLIC_PLATFORM_HOST
        ? `https://${process.env.NEXT_PUBLIC_PLATFORM_HOST}`
        : '',
    });
    await sendEmail({ to: requester.email, subject, html });
  }

  return NextResponse.json(data);
}
