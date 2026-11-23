export const AFROMESSAGE_ENDPOINT = 'https://api.afromessage.com/api/send';

export interface AfroMessageRequest {
  to: string;
  message: string;
  sender: string;
  from: string;
}

export interface AfroMessageResponse {
  acknowledge?: string;
  response?: {
    status?: string;
    message_id?: string;
    errors?: unknown;
  } | null;
}

export function normalizeAfroMessageRecipient(phone: string): string {
  const compact = phone.trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) throw new Error('The phone number is not valid.');

  const digits = compact.replace(/^\+/, '');
  if (/^0[79]\d{8}$/.test(digits)) return `+251${digits.slice(1)}`;
  if (/^[79]\d{8}$/.test(digits)) return `+251${digits}`;
  if (/^251[79]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^\d{8,15}$/.test(digits)) return `+${digits}`;
  throw new Error('The phone number is not valid.');
}

export function buildAfroMessageOtpRequest(
  phone: string,
  otp: string,
  senderName: string,
  identifierId: string,
): AfroMessageRequest {
  const normalizedOtp = otp.trim();
  const normalizedSender = senderName.trim();
  const normalizedIdentifier = identifierId.trim();

  if (!/^\d{4,10}$/.test(normalizedOtp)) throw new Error('The OTP payload is not valid.');
  if (!/^[A-Za-z0-9 ._-]{1,11}$/.test(normalizedSender)) {
    throw new Error('The AfroMessage sender name must be 1 to 11 valid characters.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedIdentifier)) {
    throw new Error('The AfroMessage identifier ID is not valid.');
  }

  return {
    to: normalizeAfroMessageRecipient(phone),
    sender: normalizedSender,
    from: normalizedIdentifier,
    message: `Your Serkle verification code is ${normalizedOtp}. Do not share this code.`,
  };
}

export function isAfroMessageSuccess(httpOk: boolean, response: AfroMessageResponse | null): boolean {
  return httpOk && response?.acknowledge?.toLowerCase() === 'success';
}

const firstProviderError = (response: AfroMessageResponse | null): string | null => {
  const errors = response?.response?.errors;
  if (!Array.isArray(errors)) return null;
  const first = errors.find(error => typeof error === 'string' && error.trim());
  return typeof first === 'string' ? first.trim() : null;
};

export function safeAfroMessageErrorMessage(
  httpStatus: number,
  response: AfroMessageResponse | null,
): string {
  if (httpStatus === 401 || httpStatus === 403) {
    return 'The SMS provider rejected its server credentials.';
  }
  if (httpStatus === 429) {
    return 'The SMS provider rate limit was reached. Please try again shortly.';
  }
  if (httpStatus >= 500) {
    return 'The SMS provider is temporarily unavailable.';
  }

  const providerMessage = firstProviderError(response);
  if (providerMessage && providerMessage.length <= 160) {
    return `The SMS provider rejected the request: ${providerMessage}`;
  }
  return 'The SMS provider could not send the verification code.';
}
