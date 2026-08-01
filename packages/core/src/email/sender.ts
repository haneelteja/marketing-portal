interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY is not set — skipping email to', opts.to);
    return;
  }

  const from = process.env.EMAIL_FROM ?? 'notifications@yourplatform.com';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '(no body)');
      console.error('[email] Resend API error', { status: res.status, body, to: opts.to, subject: opts.subject });
    }
  } catch (err) {
    console.error('[email] Failed to send email', { to: opts.to, subject: opts.subject, err });
  }
}
