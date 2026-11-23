import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import {
  AFROMESSAGE_ENDPOINT,
  buildAfroMessageOtpRequest,
  isAfroMessageSuccess,
  safeAfroMessageErrorMessage,
  type AfroMessageResponse,
} from '../_shared/afroMessage.ts';

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
    apiToken = requiredSecret('AFROMESSAGE_API_TOKEN');
    providerRequest = buildAfroMessageOtpRequest(
      phone,
      otp,
      requiredSecret('AFROMESSAGE_SENDER_NAME'),
      requiredSecret('AFROMESSAGE_IDENTIFIER_ID'),
    );
  } catch (error) {
    console.error(
      'Send SMS hook configuration or payload error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return hookError(503, 'SMS delivery is not configured correctly.');
  }

  const abortController = new AbortController();
  // Supabase HTTP Auth Hooks have a five-second deadline. Leave enough time
  // for this function to return a structured error instead of hook_timeout.
  const timeout = setTimeout(() => abortController.abort(), 4_000);

  try {
    const response = await fetch(AFROMESSAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(providerRequest),
      signal: abortController.signal,
    });

    let result: AfroMessageResponse | null = null;
    try {
      result = await response.json() as AfroMessageResponse;
    } catch {
      // A non-JSON provider response is treated as a failed send.
    }

    if (!isAfroMessageSuccess(response.ok, result)) {
      console.error('AfroMessage rejected an OTP delivery request.', {
        status: response.status,
        providerStatus: result?.acknowledge ?? 'unknown',
      });
      return hookError(
        response.status >= 400 && response.status < 600 ? response.status : 502,
        safeAfroMessageErrorMessage(response.status, result),
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
        ? 'AfroMessage OTP delivery timed out.'
        : 'AfroMessage OTP delivery failed before a response was received.',
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
