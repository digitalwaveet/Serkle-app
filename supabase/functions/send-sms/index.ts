import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import {
  buildSms251OtpRequest,
  isSms251Success,
  safeSms251ErrorMessage,
  SMS251_ENDPOINT,
  type Sms251Response,
} from '../_shared/sms251.ts';

interface SendSmsHookPayload {
  user?: {
    id?: string;
    phone?: string;
  };
  sms?: {
    otp?: string;
  };
}

const jsonHeaders = { 'Content-Type': 'application/json' };

function hookError(status: number, message: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        http_code: status,
        message,
      },
    }),
    { status, headers: jsonHeaders },
  );
}

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function standardWebhookSecret(): string {
  return requiredSecret('SEND_SMS_HOOK_SECRET').replace(/^v1,whsec_/, '');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return hookError(405, 'Method not allowed.');
  }

  let payload: SendSmsHookPayload;

  try {
    const body = await request.text();
    const webhook = new Webhook(standardWebhookSecret());
    payload = webhook.verify(
      body,
      Object.fromEntries(request.headers),
    ) as SendSmsHookPayload;
  } catch {
    return hookError(401, 'Invalid SMS hook signature.');
  }

  const phone = payload.user?.phone;
  const otp = payload.sms?.otp;

  if (!phone || !otp) {
    return hookError(400, 'The SMS hook payload is incomplete.');
  }

  let providerRequest;
  let apiToken: string;

  try {
    apiToken = requiredSecret('SMS251_API_TOKEN');
    providerRequest = buildSms251OtpRequest(
      phone,
      otp,
      requiredSecret('SMS251_SENDER_ID'),
    );
  } catch (error) {
    console.error(
      'Send SMS hook configuration or payload error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return hookError(503, 'SMS delivery is not configured correctly.');
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10_000);

  try {
    const response = await fetch(SMS251_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(providerRequest),
      signal: abortController.signal,
    });

    let result: Sms251Response | null = null;
    try {
      result = await response.json() as Sms251Response;
    } catch {
      // A non-JSON provider response is treated as a failed send.
    }

    if (!isSms251Success(response.ok, result)) {
      console.error('251SMS rejected an OTP delivery request.', {
        status: response.status,
        providerStatus: result?.status ?? 'unknown',
      });
      return hookError(
        response.status >= 400 && response.status < 600 ? response.status : 502,
        safeSms251ErrorMessage(response.status, result),
      );
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    console.error(
      timedOut
        ? '251SMS OTP delivery timed out.'
        : '251SMS OTP delivery failed before a response was received.',
    );
    return hookError(
      503,
      timedOut
        ? 'The SMS provider timed out. Please try again.'
        : 'The SMS provider is temporarily unavailable.',
    );
  } finally {
    clearTimeout(timeout);
  }
});
