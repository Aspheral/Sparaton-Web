export interface EmailMessage {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id: string }>;
}

export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<{ id: string }> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {})
      },
      body: JSON.stringify({ from: message.from, to: message.to, subject: message.subject, html: message.html, text: message.text })
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    const result = await response.json<{ id: string }>();
    return { id: result.id };
  }
}

export function verificationEmail(input: { from:string; to:string; name:string; verifyUrl:string }): EmailMessage {
  const safeName = escapeHtml(input.name);
  const safeUrl = escapeHtml(input.verifyUrl);
  return {
    from: input.from,
    to: input.to,
    subject: 'Verify your Sparaton inquiry',
    text: `Hi ${input.name},\n\nVerify your email to open your private Sparaton ticket:\n${input.verifyUrl}\n\nThis link expires in 30 minutes.`,
    html: shell('Verify your inquiry', `<p>Hi ${safeName},</p><p>Use the secure link below to verify your email and open your private Sparaton ticket.</p><p><a href="${safeUrl}">Open and verify ticket</a></p><p style="color:#666">This link expires in 30 minutes.</p>`)
  };
}

export function ticketReplyEmail(input:{ from:string; to:string; subject:string; preview:string; ticketUrl:string }): EmailMessage {
  const preview=escapeHtml(input.preview);
  const url=escapeHtml(input.ticketUrl);
  return {
    from: input.from,
    to: input.to,
    subject: `New reply: ${input.subject}`,
    text: `A new reply was added to “${input.subject}”.\n\n${input.preview}\n\nOpen your private ticket:\n${input.ticketUrl}`,
    html:shell('New ticket reply', `<p><strong>${escapeHtml(input.subject)}</strong></p><p>${preview}</p><p><a href="${url}">Open private ticket</a></p><p style="color:#666">For security, this email does not contain a ticket access token.</p>`)
  };
}

export function staffTicketNotificationEmail(input:{ from:string; to:string; subject:string; preview:string; adminUrl:string; requesterName:string }): EmailMessage {
  const url=escapeHtml(input.adminUrl);
  return {
    from: input.from,
    to: input.to,
    subject: `Ticket waiting: ${input.subject}`,
    text: `${input.requesterName} replied to “${input.subject}”.\n\n${input.preview}\n\nOpen the staff workspace:\n${input.adminUrl}`,
    html:shell('A ticket is waiting for staff', `<p><strong>${escapeHtml(input.subject)}</strong></p><p>${escapeHtml(input.requesterName)} sent a new message:</p><p>${escapeHtml(input.preview)}</p><p><a href="${url}">Open staff workspace</a></p>`)
  };
}

function shell(title:string, body:string):string {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:32px;color:#171715"><p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase">Sparaton Studios</p><h1 style="font-family:Georgia,serif;font-weight:500">${escapeHtml(title)}</h1>${body}</div>`;
}

function escapeHtml(value:string):string {
  return value.replace(/[&<>'"]/g,(char)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char] ?? char));
}
