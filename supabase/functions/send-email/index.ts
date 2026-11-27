import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { deliverAuthEmail } from '../_shared/authEmailDelivery.ts';
import {
  buildAuthEmailMessages,
  type AuthEmailHookPayload,
} from '../_shared/serkleEmail.ts';

const jsonHeaders = { 'Content-Type': 'application/json' };

interface QueuedEmail {
  id: string;
  recipient: string;
  subject: string;
  html: string;
  text_body: string;
  message_id: string;
}

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

function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

async function deterministicMessageId(webhookId: string, index: number): Promise<string> {
  const bytes = new TextEncoder().encode(`serkle-auth:${webhookId}:${index}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const token = Array.from(digest.slice(0, 16), (value) => value.toString(16).padStart(2, '0')).join('');
  return `<serkle-auth-${token}@littletigersgroup.com>`;
}

async function adminRequest(path: string, init: RequestInit): Promise<Response> {
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${requiredEnv('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function enqueueMessages(payload: AuthEmailHookPayload, webhookId: string): Promise<void> {
  const messages = buildAuthEmailMessages(payload, requiredEnv('SUPABASE_URL'));
  const rows = await Promise.all(messages.map(async (message, index) => ({
    webhook_id: webhookId,
    message_index: index,
    recipient: message.to,
    subject: message.subject,
    html: message.html,
    text_body: message.text,
    message_id: await deterministicMessageId(webhookId, index),
  })));
  const response = await adminRequest(
    'auth_email_outbox?on_conflict=webhook_id%2Cmessage_index',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    },
  );
  if (!response.ok) throw new Error(`Email outbox rejected the request (${response.status}).`);
}

async function completeMessage(id: string, workerId: string, error?: string): Promise<void> {
  const response = await adminRequest('rpc/complete_auth_email_outbox', {
    method: 'POST',
    body: JSON.stringify({ p_id: id, p_worker_id: workerId, p_error: error || null }),
  });
  if (!response.ok) throw new Error(`Could not update email outbox status (${response.status}).`);
}

async function drainOutbox(): Promise<{ claimed: number; sent: number; failed: number }> {
  const apiKey = requiredEnv('RESEND_API_KEY');
  const from = requiredEnv('AUTH_EMAIL_RESEND_FROM');
  const workerId = crypto.randomUUID();
  const response = await adminRequest('rpc/claim_auth_email_outbox', {
    method: 'POST',
    body: JSON.stringify({ p_worker_id: workerId, p_limit: 1 }),
  });
  if (!response.ok) throw new Error(`Could not claim queued email (${response.status}).`);
  const queued = await response.json() as QueuedEmail[];
  let sent = 0;
  let failed = 0;

  for (const message of queued) {
    try {
      const delivery = await deliverAuthEmail({
        to: message.recipient,
        subject: message.subject,
        html: message.html,
        text: message.text_body,
        messageId: message.message_id,
      }, {
        apiKey,
        from,
        sendSmtp: async (mail) => {
          const { sendSmtpMail } = await import('../_shared/smtpMailer.ts');
          return sendSmtpMail(mail);
        },
      });
      console.log('Authentication email accepted by provider.', {
        queueId: message.id,
        ...delivery,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Email delivery failed.';
      console.error('Queued authentication email failed.', detail);
      await completeMessage(message.id, workerId, detail);
      failed += 1;
      continue;
    }
    await completeMessage(message.id, workerId);
    sent += 1;
  }

  return { claimed: queued.length, sent, failed };
}

async function kickWorker(): Promise<void> {
  const response = await fetch(`${requiredEnv('SUPABASE_URL')}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'x-email-worker-secret': requiredEnv('AUTH_EMAIL_WORKER_SECRET') },
  });
  if (!response.ok) throw new Error(`Email worker kick failed (${response.status}).`);
}

function continueInBackground(task: Promise<unknown>): void {
  const runtime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
  }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task);
  else void task;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return hookError(405, 'Method not allowed.');

  const workerHeader = request.headers.get('x-email-worker-secret') || '';
  if (workerHeader) {
    if (!safeEqual(workerHeader, requiredEnv('AUTH_EMAIL_WORKER_SECRET'))) {
      return hookError(401, 'Invalid email worker secret.');
    }
    try {
      if (new URL(request.url).searchParams.get('check') === 'smtp') {
        const { verifySmtpConnection } = await import('../_shared/smtpMailer.ts');
        try {
          await verifySmtpConnection();
        } catch {
          return hookError(503, 'SMTP fallback could not connect or authenticate.');
        }
        return new Response(JSON.stringify({ smtp: 'ready' }), { status: 200, headers: jsonHeaders });
      }
      return new Response(JSON.stringify(await drainOutbox()), { status: 200, headers: jsonHeaders });
    } catch (error) {
      console.error('Authentication email worker failed.', error instanceof Error ? error.message : 'Unknown error');
      return hookError(503, 'Authentication email worker is temporarily unavailable.');
    }
  }

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
    const webhookId = request.headers.get('webhook-id') || crypto.randomUUID();
    await enqueueMessages(payload, webhookId);
    continueInBackground(kickWorker().catch((error) => {
      console.error('Immediate authentication email worker kick failed.', error instanceof Error ? error.message : 'Unknown error');
    }));
    console.log('Authentication email queued.', {
      action: payload.email_data.email_action_type,
    });
    return new Response(JSON.stringify({}), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error(
      'Authentication email queue failed.',
      error instanceof Error ? error.message : 'Unknown queue failure',
    );
    return hookError(503, 'Authentication email could not be queued.');
  }
});
