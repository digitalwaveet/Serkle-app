import {
  buildNotificationEmail,
  isEmailAddress,
  type NotificationEmailTemplate,
} from '../_shared/serkleEmail.ts';
import {
  deterministicMessageId,
  sendSmtpMail,
} from '../_shared/smtpMailer.ts';

interface NotificationRequest {
  eventId?: string;
  to?: string;
  template?: NotificationEmailTemplate;
  data?: Record<string, unknown>;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function secretsMatch(received: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [receivedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(receivedHash);
  const right = new Uint8Array(expectedHash);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const expectedSecret = Deno.env.get('MAILER_INTERNAL_SECRET')?.trim();
  const authorization = request.headers.get('authorization') ?? '';
  const receivedSecret = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expectedSecret || !receivedSecret || !await secretsMatch(receivedSecret, expectedSecret)) {
    return json(401, { error: 'Authentication required.' });
  }

  const declaredSize = Number(request.headers.get('content-length') || '0');
  if (declaredSize > 32_768) return json(413, { error: 'Request is too large.' });

  let body: NotificationRequest;
  try {
    body = await request.json() as NotificationRequest;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const eventId = body.eventId?.trim() ?? '';
  const recipient = body.to?.trim() ?? '';
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(eventId)) return json(400, { error: 'A valid eventId is required.' });
  if (!isEmailAddress(recipient)) return json(400, { error: 'A valid recipient is required.' });
  if (!body.template || !body.data || typeof body.data !== 'object') {
    return json(400, { error: 'A supported template and template data are required.' });
  }

  try {
    const message = buildNotificationEmail(body.template, body.data);
    const messageId = await sendSmtpMail({
      ...message,
      to: recipient,
      messageId: await deterministicMessageId('serkle-notify', eventId),
    });
    console.log('Notification email accepted by SMTP.', { template: body.template, eventId });
    return json(200, { success: true, messageId });
  } catch (error) {
    console.error(
      'Notification email delivery failed.',
      error instanceof Error ? error.message : 'Unknown SMTP failure',
    );
    return json(503, { error: 'Notification email delivery is temporarily unavailable.' });
  }
});
