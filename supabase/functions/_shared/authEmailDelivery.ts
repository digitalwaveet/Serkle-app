interface AuthMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  messageId: string;
}

interface DeliveryOptions {
  apiKey: string;
  from: string;
  sendSmtp: (message: AuthMail) => Promise<string>;
  request?: typeof fetch;
}

// These responses explicitly reject the send. A timeout, conflict, or server
// error can leave acceptance uncertain, so retry Resend with the same key.
const FALLBACK_STATUSES = new Set([401, 403, 429]);

export async function deliverAuthEmail(message: AuthMail, options: DeliveryOptions) {
  let response: Response;
  try {
    response = await (options.request ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': message.messageId,
      },
      body: JSON.stringify({
        from: options.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error('Resend request failed before acceptance could be verified.');
  }

  if (response.ok) {
    const result = await response.json().catch(() => null);
    if (typeof result?.id !== 'string' || !result.id) {
      throw new Error('Resend did not return an email ID.');
    }
    return { provider: 'resend', id: result.id };
  }

  await response.body?.cancel().catch(() => {});
  if (!FALLBACK_STATUSES.has(response.status)) {
    throw new Error(`Resend send failed (HTTP ${response.status}).`);
  }

  try {
    const id = await options.sendSmtp(message);
    return { provider: 'smtp', id, resendStatus: response.status };
  } catch {
    throw new Error(`Resend rejected the send (HTTP ${response.status}); SMTP fallback failed.`);
  }
}
