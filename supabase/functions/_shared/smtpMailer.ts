import nodemailer from 'npm:nodemailer@^9';

export interface SmtpMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  messageId?: string;
}

type MailTransport = ReturnType<typeof nodemailer.createTransport>;
let transport: MailTransport | null = null;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function smtpTransport(): MailTransport {
  if (transport) return transport;

  const host = requiredEnv('SMTP_HOSTNAME');
  const port = Number(requiredEnv('SMTP_PORT'));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('SMTP_PORT is invalid.');

  transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: requiredEnv('SMTP_USERNAME'),
      pass: requiredEnv('SMTP_PASSWORD'),
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: {
      servername: host,
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
  });

  return transport;
}

export async function deterministicMessageId(namespace: string, key: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${namespace}:${key}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const token = Array.from(digest.slice(0, 16), (value) => value.toString(16).padStart(2, '0')).join('');
  return `<${namespace}-${token}@littletigersgroup.com>`;
}

export async function sendSmtpMail(message: SmtpMessage): Promise<string> {
  const fromAddress = requiredEnv('SMTP_FROM');
  const fromName = Deno.env.get('SMTP_FROM_NAME')?.trim() || 'Serkle';
  const info = await smtpTransport().sendMail({
    from: { name: fromName, address: fromAddress },
    to: message.to,
    subject: message.subject.replace(/[\r\n]+/g, ' ').slice(0, 160),
    html: message.html,
    text: message.text,
    messageId: message.messageId,
  });

  if (!Array.isArray(info.accepted) || info.accepted.length === 0) {
    throw new Error('SMTP server did not accept the recipient.');
  }

  return info.messageId;
}

export async function verifySmtpConnection(): Promise<void> {
  await smtpTransport().verify();
}
