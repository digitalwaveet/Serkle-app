import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliverAuthEmail } from '../../supabase/functions/_shared/authEmailDelivery.ts';
import {
  buildAuthEmailMessages,
  buildNotificationEmail,
  escapeEmailHtml,
  type AuthEmailHookPayload,
} from '../../supabase/functions/_shared/serkleEmail.ts';

const supabaseUrl = 'https://zewcewkqruxlniavsrgj.supabase.co';

test('Resend uses a stable idempotency key and SMTP handles explicit provider rejection', async () => {
  const [email] = buildAuthEmailMessages(authPayload(), supabaseUrl);
  const message = { ...email, messageId: '<test@serkle.app>' };
  for (const [status, expected] of [[200, 'resend'], [429, 'smtp']] as const) {
    let fallbackCount = 0;
    const result = await deliverAuthEmail(message, {
      apiKey: 'test',
      from: 'Serkle <no-reply@serkle.app>',
      request: async (_url, init) => {
        assert.equal(new Headers(init?.headers).get('Idempotency-Key'), message.messageId);
        assert.deepEqual(JSON.parse(String(init?.body)).to, [email.to]);
        return new Response(status === 200 ? JSON.stringify({ id: 'resend-id' }) : null, { status });
      },
      sendSmtp: async (fallbackMessage) => {
        fallbackCount++;
        assert.deepEqual(fallbackMessage, message);
        return 'smtp-id';
      },
    });
    assert.equal(result.provider, expected);
    assert.equal(fallbackCount, expected === 'smtp' ? 1 : 0);
  }
});

test('uncertain Resend responses retry the primary without invoking SMTP', async () => {
  const [email] = buildAuthEmailMessages(authPayload(), supabaseUrl);
  await assert.rejects(deliverAuthEmail({ ...email, messageId: '<test@serkle.app>' }, {
    apiKey: 'test',
    from: 'Serkle <no-reply@serkle.app>',
    request: async () => new Response(null, { status: 503 }),
    sendSmtp: async () => assert.fail('SMTP would risk delivering a duplicate'),
  }), /HTTP 503/);
});

function authPayload(overrides: Partial<AuthEmailHookPayload> = {}): AuthEmailHookPayload {
  return {
    user: {
      email: 'member@example.com',
      ...overrides.user,
    },
    email_data: {
      token: '123456',
      token_hash: 'signup-hash',
      redirect_to: 'https://serkle-app-five.vercel.app/verify-account',
      email_action_type: 'signup',
      site_url: 'https://serkle-app-five.vercel.app',
      token_new: '',
      token_hash_new: '',
      ...overrides.email_data,
    },
  };
}

test('builds a branded signup OTP with a valid Supabase confirmation link', () => {
  const [message] = buildAuthEmailMessages(authPayload(), supabaseUrl);
  assert.equal(message.to, 'member@example.com');
  assert.match(message.subject, /verify/i);
  assert.match(message.text, /123456/);
  assert.match(message.html, /SERKLE/);

  const link = message.text.match(/https:\/\/[^\s]+/)?.[0];
  assert.ok(link);
  const url = new URL(link);
  assert.equal(url.pathname, '/auth/v1/verify');
  assert.equal(url.searchParams.get('token'), 'signup-hash');
  assert.equal(url.searchParams.get('type'), 'signup');
});

test('uses recovery-specific subject and action', () => {
  const [message] = buildAuthEmailMessages(authPayload({
    email_data: {
      ...authPayload().email_data,
      email_action_type: 'recovery',
      token_hash: 'recovery-hash',
    },
  }), supabaseUrl);
  assert.match(message.subject, /reset/i);
  assert.match(message.text, /reset your password/i);
  assert.match(message.text, /type=recovery/);
});

test('secure email change sends the documented token and reversed hash pairs', () => {
  const messages = buildAuthEmailMessages(authPayload({
    user: { email: 'old@example.com', new_email: 'new@example.com' },
    email_data: {
      ...authPayload().email_data,
      email_action_type: 'email_change',
      token: '111111',
      token_hash: 'hash-for-new',
      token_new: '222222',
      token_hash_new: 'hash-for-current',
    },
  }), supabaseUrl);

  assert.equal(messages.length, 2);
  assert.equal(messages[0].to, 'old@example.com');
  assert.match(messages[0].text, /111111/);
  assert.match(messages[0].text, /hash-for-current/);
  assert.equal(messages[1].to, 'new@example.com');
  assert.match(messages[1].text, /222222/);
  assert.match(messages[1].text, /hash-for-new/);
});

test('non-secure email change sends one message to the new address', () => {
  const messages = buildAuthEmailMessages(authPayload({
    user: { email: 'old@example.com', new_email: 'new@example.com' },
    email_data: {
      ...authPayload().email_data,
      email_action_type: 'email_change',
      token: '333333',
      token_hash: 'single-hash',
      token_new: '',
      token_hash_new: '',
    },
  }), supabaseUrl);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, 'new@example.com');
  assert.match(messages[0].text, /333333/);
});

test('notification templates escape user-controlled HTML', () => {
  const message = buildNotificationEmail('general', {
    title: 'New <script>alert(1)</script>',
    message: '<img src=x onerror=alert(1)>',
    actionUrl: 'https://serkle-app-five.vercel.app/notifications',
  });
  assert.doesNotMatch(message.html, /<script>|<img/i);
  assert.match(message.html, /&lt;script&gt;/);
  assert.match(message.html, /&lt;img/);
});

test('notification mailer rejects unsupported templates and unsafe links', () => {
  assert.throws(() => buildNotificationEmail('unknown' as never, {}));
  const message = buildNotificationEmail('general', {
    title: 'Hello',
    message: 'Safe message',
    actionUrl: 'javascript:alert(1)',
  });
  assert.doesNotMatch(message.html, /javascript:/i);
});

test('HTML escaping covers attribute-breaking characters', () => {
  assert.equal(escapeEmailHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#039;');
});
