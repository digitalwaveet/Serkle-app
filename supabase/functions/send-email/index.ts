import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import {
  buildAuthEmailMessages,
  type AuthEmailHookPayload,
} from '../_shared/serkleEmail.ts';
import {
  deterministicMessageId,
  sendSmtpMail,
} from '../_shared/smtpMailer.ts';

const jsonHeaders = { 'Content-Type': 'application/json' };

function hookError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: jsonHeaders,
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return hookError(405, 'Method not allowed.');

  let payload: AuthEmailHookPayload;
  try {
    const rawBody = await request.text();
    const hookSecret = requiredEnv('SEND_EMAIL_HOOK_SECRET').replace(/^v1,whsec_/, '');
    payload = new Webhook(hookSecret).verify(
      rawBody,
      Object.fromEntries(request.headers),
    ) as AuthEmailHookPayload;
  } catch {
    return hookError(401, 'Invalid email hook signature.');
  }

  try {
    const messages = buildAuthEmailMessages(payload, requiredEnv('SUPABASE_URL'));
    const webhookId = request.headers.get('webhook-id') || crypto.randomUUID();

    for (const [index, message] of messages.entries()) {
      await sendSmtpMail({
        ...message,
        messageId: await deterministicMessageId('serkle-auth', `${webhookId}:${index}`),
      });
    }

    console.log('Authentication email accepted by SMTP.', {
      action: payload.email_data.email_action_type,
      messageCount: messages.length,
    });
    return new Response(JSON.stringify({}), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error(
      'Authentication email delivery failed.',
      error instanceof Error ? error.message : 'Unknown SMTP failure',
    );
    return hookError(503, 'Authentication email delivery is temporarily unavailable.');
  }
});
