/** Shared inline styles */
const base = `font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;margin:0;padding:0;`;
const card = `max-width:560px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);`;
const header = (color: string) =>
  `background:${color};padding:28px 32px;`;
const headerText = `color:#ffffff;font-size:22px;font-weight:700;margin:0;`;
const body = `padding:28px 32px;color:#374151;font-size:15px;line-height:1.6;`;
const label = `font-weight:600;color:#111827;`;
const btn = (bg: string) =>
  `display:inline-block;margin-top:20px;padding:12px 24px;background:${bg};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;`;
const footer = `padding:16px 32px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;`;

function wrap(headerColor: string, title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="${base}">
  <div style="${card}">
    <div style="${header(headerColor)}">
      <p style="${headerText}">${title}</p>
    </div>
    <div style="${body}">
      ${bodyHtml}
    </div>
    <div style="${footer}">You received this notification from your marketing platform.</div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------

export function approvalDecidedEmail(opts: {
  targetType: string;
  targetName: string;
  status: 'approved' | 'rejected';
  comment?: string;
  decidedBy: string;
  workspaceUrl: string;
}): { subject: string; html: string } {
  const isApproved = opts.status === 'approved';
  const statusLabel = isApproved ? 'Approved' : 'Rejected';
  const statusColor = isApproved ? '#16a34a' : '#dc2626';
  const headerColor = isApproved ? '#16a34a' : '#dc2626';
  const subject = `Your ${opts.targetType} has been ${statusLabel.toLowerCase()}`;

  const commentHtml = opts.comment
    ? `<p><span style="${label}">Comment:</span> ${opts.comment}</p>`
    : '';

  const ctaHtml = opts.workspaceUrl
    ? `<a href="${opts.workspaceUrl}" style="${btn(headerColor)}">View in Workspace</a>`
    : '';

  const html = wrap(
    headerColor,
    `${statusLabel}: ${opts.targetType}`,
    `<p>Your <span style="${label}">${opts.targetType}</span>
       (<code>${opts.targetName}</code>) has been
       <span style="color:${statusColor};font-weight:700;">${statusLabel.toLowerCase()}</span>.</p>
     <p><span style="${label}">Decided by:</span> ${opts.decidedBy}</p>
     ${commentHtml}
     ${ctaHtml}`,
  );

  return { subject, html };
}

// ---------------------------------------------------------------------------

export function publishSuccessEmail(opts: {
  platform: string;
  caption?: string;
  platformPostId: string;
  workspaceUrl: string;
}): { subject: string; html: string } {
  const subject = `Post published successfully on ${opts.platform}`;

  const captionHtml = opts.caption
    ? `<p><span style="${label}">Caption:</span> ${opts.caption}&hellip;</p>`
    : '';

  const ctaHtml = opts.workspaceUrl
    ? `<a href="${opts.workspaceUrl}" style="${btn('#2563eb')}">View Analytics</a>`
    : '';

  const html = wrap(
    '#2563eb',
    'Post Published',
    `<p>Your post was published successfully on <span style="${label}">${opts.platform}</span>.</p>
     <p><span style="${label}">Platform post ID:</span> <code>${opts.platformPostId}</code></p>
     ${captionHtml}
     ${ctaHtml}`,
  );

  return { subject, html };
}

// ---------------------------------------------------------------------------

export function publishFailedEmail(opts: {
  platform: string;
  reason: string;
  workspaceUrl: string;
}): { subject: string; html: string } {
  const subject = `Post failed to publish on ${opts.platform}`;

  const ctaHtml = opts.workspaceUrl
    ? `<a href="${opts.workspaceUrl}" style="${btn('#dc2626')}">View Details</a>`
    : '';

  const html = wrap(
    '#dc2626',
    'Publish Failed',
    `<p>A post scheduled for <span style="${label}">${opts.platform}</span> failed to publish.</p>
     <p><span style="${label}">Reason:</span> ${opts.reason}</p>
     <p>Please review the post and try again.</p>
     ${ctaHtml}`,
  );

  return { subject, html };
}

// ---------------------------------------------------------------------------

export function tokenExpiringEmail(opts: {
  platform: string;
  expiresAt: string;
  reconnectUrl: string;
}): { subject: string; html: string } {
  const subject = `Action required: reconnect your ${opts.platform} account`;

  const ctaHtml = opts.reconnectUrl
    ? `<a href="${opts.reconnectUrl}" style="${btn('#d97706')}">Reconnect Account</a>`
    : '';

  const html = wrap(
    '#d97706',
    'Social Account Token Expired',
    `<p>Your <span style="${label}">${opts.platform}</span> connection has expired and can no longer publish posts.</p>
     <p><span style="${label}">Expired at:</span> ${new Date(opts.expiresAt).toLocaleString()}</p>
     <p>Please reconnect your account to restore publishing.</p>
     ${ctaHtml}`,
  );

  return { subject, html };
}

// ---------------------------------------------------------------------------

export function quotaNearLimitEmail(opts: {
  usedUnits: number;
  limitUnits: number;
  clientName: string;
}): { subject: string; html: string } {
  const pct = Math.round((opts.usedUnits / opts.limitUnits) * 100);
  const subject = `Quota alert: ${opts.clientName} has used ${pct}% of their limit`;

  const barWidth = Math.min(pct, 100);
  const barColor = pct >= 90 ? '#dc2626' : '#d97706';

  const html = wrap(
    '#d97706',
    'Quota Near Limit',
    `<p>Client <span style="${label}">${opts.clientName}</span> is approaching their usage quota.</p>
     <p>
       <span style="${label}">Usage:</span>
       ${opts.usedUnits.toLocaleString()} / ${opts.limitUnits.toLocaleString()} units
       (<span style="color:${barColor};font-weight:700;">${pct}%</span>)
     </p>
     <div style="background:#e5e7eb;border-radius:4px;height:10px;margin:12px 0;">
       <div style="background:${barColor};width:${barWidth}%;height:10px;border-radius:4px;"></div>
     </div>
     <p>Consider reviewing their plan or contacting them before they hit the limit.</p>`,
  );

  return { subject, html };
}
