export type AuthEmailAction =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email';

export type NotificationEmailTemplate =
  | 'welcome'
  | 'security_alert'
  | 'payment_receipt'
  | 'circle_invitation'
  | 'sos_alert'
  | 'general';

export interface AuthEmailHookPayload {
  user: {
    email: string;
    new_email?: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: AuthEmailAction | string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
    old_email?: string;
  };
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface AuthMessageTarget {
  to: string;
  token: string;
  tokenHash: string;
  action: AuthEmailAction;
  context?: 'current' | 'new';
}

const AUTH_ACTIONS = new Set<AuthEmailAction>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function confirmationUrl(
  supabaseUrl: string,
  target: AuthMessageTarget,
  redirectTo: string,
): string {
  const url = new URL('/auth/v1/verify', supabaseUrl);
  url.searchParams.set('token', target.tokenHash);
  url.searchParams.set('type', target.action);
  if (redirectTo) url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}

function authCopy(target: AuthMessageTarget) {
  if (target.action === 'recovery') {
    return {
      subject: 'Reset your Serkle password',
      preheader: 'Use your secure code to reset your Serkle password.',
      title: 'Reset your password',
      message: 'We received a request to reset your Serkle password. Enter this code in Serkle or use the secure button below.',
      button: 'Reset password',
    };
  }

  if (target.action === 'invite') {
    return {
      subject: 'You are invited to Serkle',
      preheader: 'Accept your invitation to join Serkle.',
      title: 'You’re invited',
      message: 'You have been invited to join Serkle. Use this code or the secure button below to accept the invitation.',
      button: 'Accept invitation',
    };
  }

  if (target.action === 'magiclink') {
    return {
      subject: 'Your Serkle sign-in code',
      preheader: 'Use this secure code to sign in to Serkle.',
      title: 'Sign in to Serkle',
      message: 'Use this one-time code or the secure button below to sign in. If you did not request this, you can ignore this email.',
      button: 'Sign in securely',
    };
  }

  if (target.action === 'email_change') {
    const current = target.context === 'current';
    return {
      subject: current ? 'Confirm your current Serkle email' : 'Confirm your new Serkle email',
      preheader: 'Confirm the email-address change on your Serkle account.',
      title: current ? 'Confirm your current email' : 'Confirm your new email',
      message: 'Use this code or the secure button below to confirm the email-address change. If you did not request this change, secure your account immediately.',
      button: 'Confirm email change',
    };
  }

  return {
    subject: 'Verify your Serkle email',
    preheader: 'Use your verification code to finish setting up Serkle.',
    title: 'Verify your email',
    message: 'Enter this verification code in Serkle or use the secure button below to confirm your email address.',
    button: 'Verify email',
  };
}

function emailShell(options: {
  preheader: string;
  title: string;
  message: string;
  code?: string;
  buttonLabel?: string;
  buttonUrl?: string | null;
  footer?: string;
}): string {
  const code = options.code
    ? `<div style="margin:24px 0;padding:18px 16px;border-radius:16px;background:#f8f2ee;border:1px solid #ead9ce;text-align:center;font-size:30px;line-height:1;font-weight:800;letter-spacing:8px;color:#7c3f25;">${escapeEmailHtml(options.code)}</div>`
    : '';
  const button = options.buttonLabel && options.buttonUrl
    ? `<p style="margin:26px 0 12px;text-align:center;"><a href="${escapeEmailHtml(options.buttonUrl)}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#7c3f25;color:#ffffff;text-decoration:none;font-weight:700;">${escapeEmailHtml(options.buttonLabel)}</a></p>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f6f4f2;color:#211a17;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeEmailHtml(options.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4f2;padding:28px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e8e0db;border-radius:24px;overflow:hidden;box-shadow:0 12px 30px rgba(64,39,28,.08);">
      <tr><td style="padding:28px 30px 18px;border-bottom:1px solid #f0e9e5;"><div style="font-size:13px;font-weight:800;letter-spacing:3px;color:#7c3f25;">SERKLE</div></td></tr>
      <tr><td style="padding:30px;"><h1 style="margin:0 0 14px;font-size:27px;line-height:1.2;color:#211a17;">${escapeEmailHtml(options.title)}</h1><p style="margin:0;font-size:16px;line-height:1.65;color:#665b55;">${escapeEmailHtml(options.message)}</p>${code}${button}<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#8b817b;">${escapeEmailHtml(options.footer ?? 'For your security, never share verification codes or passwords with anyone.')}</p></td></tr>
      <tr><td style="padding:18px 30px;background:#fbf8f6;font-size:12px;line-height:1.55;color:#8b817b;">Sent securely by Serkle · Little Tigers Group</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function authTargets(payload: AuthEmailHookPayload): AuthMessageTarget[] {
  const action = payload.email_data.email_action_type as AuthEmailAction;
  if (!AUTH_ACTIONS.has(action)) throw new Error('Unsupported authentication email action.');

  const currentEmail = payload.user.email?.trim();
  const newEmail = payload.user.new_email?.trim();
  const { token, token_hash: tokenHash, token_new: tokenNew = '', token_hash_new: tokenHashNew = '' } = payload.email_data;

  if (action !== 'email_change') {
    if (!isEmailAddress(currentEmail) || !token || !tokenHash) throw new Error('Authentication email payload is incomplete.');
    return [{ to: currentEmail, token, tokenHash, action }];
  }

  if (!isEmailAddress(newEmail ?? '')) throw new Error('The new email address is missing or invalid.');

  if (token && tokenNew && tokenHash && tokenHashNew) {
    if (!isEmailAddress(currentEmail)) throw new Error('The current email address is invalid.');
    return [
      { to: currentEmail, token, tokenHash: tokenHashNew, action, context: 'current' },
      { to: newEmail!, token: tokenNew, tokenHash, action, context: 'new' },
    ];
  }

  const oneToken = tokenNew || token;
  if (!oneToken || !tokenHash) throw new Error('Email change verification data is incomplete.');
  return [{ to: newEmail!, token: oneToken, tokenHash, action, context: 'new' }];
}

export function buildAuthEmailMessages(payload: AuthEmailHookPayload, supabaseUrl: string): EmailMessage[] {
  const redirectTo = safeUrl(payload.email_data.redirect_to) ?? '';
  return authTargets(payload).map((target) => {
    const copy = authCopy(target);
    const link = confirmationUrl(supabaseUrl, target, redirectTo);
    return {
      to: target.to,
      subject: copy.subject,
      html: emailShell({
        preheader: copy.preheader,
        title: copy.title,
        message: copy.message,
        code: target.token,
        buttonLabel: copy.button,
        buttonUrl: link,
      }),
      text: `${copy.title}\n\n${copy.message}\n\nCode: ${target.token}\n\n${link}\n\nNever share verification codes or passwords with anyone.`,
    };
  });
}

function dataText(data: Record<string, unknown>, key: string, max = 500, required = true): string {
  const value = typeof data[key] === 'string' ? data[key].trim() : '';
  if (required && !value) throw new Error(`Notification field ${key} is required.`);
  if (value.length > max) throw new Error(`Notification field ${key} is too long.`);
  return value;
}

export function buildNotificationEmail(
  template: NotificationEmailTemplate,
  data: Record<string, unknown>,
): Omit<EmailMessage, 'to'> {
  if (template === 'welcome') {
    const name = dataText(data, 'name', 80, false) || 'there';
    return {
      subject: 'Welcome to Serkle',
      html: emailShell({ preheader: 'Welcome to the Serkle community.', title: `Welcome, ${name}`, message: 'Your Serkle account is ready. Connect, share and support your community from one secure place.' }),
      text: `Welcome, ${name}\n\nYour Serkle account is ready. Connect, share and support your community from one secure place.`,
    };
  }

  if (template === 'security_alert') {
    const title = dataText(data, 'title', 100);
    const message = dataText(data, 'message', 1000);
    return {
      subject: `Serkle security alert: ${title}`,
      html: emailShell({ preheader: title, title, message, footer: 'If this activity was not yours, change your password and review your active sessions immediately.' }),
      text: `${title}\n\n${message}\n\nIf this activity was not yours, change your password and review your active sessions immediately.`,
    };
  }

  if (template === 'payment_receipt') {
    const reference = dataText(data, 'reference', 100);
    const amount = dataText(data, 'amount', 50);
    const description = dataText(data, 'description', 500);
    return {
      subject: `Serkle payment receipt · ${reference}`,
      html: emailShell({ preheader: `Payment receipt ${reference}`, title: 'Payment received', message: `${description} Amount: ${amount}. Reference: ${reference}.`, footer: 'Keep this email as your transaction record.' }),
      text: `Payment received\n\n${description}\nAmount: ${amount}\nReference: ${reference}\n\nKeep this email as your transaction record.`,
    };
  }

  if (template === 'circle_invitation') {
    const inviter = dataText(data, 'inviter', 80);
    const circle = dataText(data, 'circle', 120);
    const invitationUrl = safeUrl(data.invitationUrl);
    return {
      subject: `${inviter} invited you to ${circle}`,
      html: emailShell({ preheader: `Invitation to ${circle}`, title: `Join ${circle}`, message: `${inviter} invited you to join this Circle on Serkle.`, buttonLabel: invitationUrl ? 'View invitation' : undefined, buttonUrl: invitationUrl }),
      text: `${inviter} invited you to join ${circle} on Serkle.${invitationUrl ? `\n\n${invitationUrl}` : ''}`,
    };
  }

  if (template === 'sos_alert') {
    const name = dataText(data, 'name', 80);
    const alertType = dataText(data, 'alertType', 80);
    const urgency = dataText(data, 'urgency', 40);
    const description = dataText(data, 'description', 1200);
    const location = dataText(data, 'location', 300, false) || 'Location not provided';
    const mapUrl = safeUrl(data.mapUrl);
    const message = `${name} triggered a ${alertType} SOS alert (${urgency}). ${description} Location: ${location}`;
    return {
      subject: `Emergency alert from ${name}`,
      html: emailShell({ preheader: `Emergency alert from ${name}`, title: 'Emergency alert', message, buttonLabel: mapUrl ? 'View location' : undefined, buttonUrl: mapUrl, footer: `Please try to contact ${name} immediately.` }),
      text: `Emergency alert\n\n${message}${mapUrl ? `\n\nMap: ${mapUrl}` : ''}\n\nPlease try to contact ${name} immediately.`,
    };
  }

  if (template !== 'general') throw new Error('Unsupported notification email template.');
  const title = dataText(data, 'title', 100);
  const message = dataText(data, 'message', 1500);
  const actionUrl = safeUrl(data.actionUrl);
  const actionLabel = dataText(data, 'actionLabel', 40, false) || 'Open Serkle';
  return {
    subject: title,
    html: emailShell({ preheader: title, title, message, buttonLabel: actionUrl ? actionLabel : undefined, buttonUrl: actionUrl }),
    text: `${title}\n\n${message}${actionUrl ? `\n\n${actionUrl}` : ''}`,
  };
}
