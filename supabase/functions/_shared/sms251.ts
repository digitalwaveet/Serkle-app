export const SMS251_ENDPOINT = 'https://app.251sms.com/api/v3/sms/send';

export interface Sms251Request {
  recipient: string;
  sender_id: string;
  type: 'otp';
  message: string;
}

export interface Sms251Response {
  status?: string;
  message?: string;
  data?: unknown;
}

export function normalizeSms251Recipient(phone: string): string {
  const compact = phone.trim().replace(/[\s().-]/g, '');

  if (!/^\+?\d+$/.test(compact)) {
    throw new Error('The phone number is not valid.');
  }

  const digits = compact.replace(/^\+/, '');
  const recipient = /^251[79]\d{8}$/.test(digits)
    ? `0${digits.slice(3)}`
    : digits;

  if (!/^\d{8,15}$/.test(recipient)) {
    throw new Error('The phone number is not valid.');
  }

  return recipient;
}

export function buildSms251OtpRequest(
  phone: string,
  otp: string,
  senderId: string,
): Sms251Request {
  const normalizedOtp = otp.trim();
  const normalizedSenderId = senderId.trim();

  if (!/^\d{4,10}$/.test(normalizedOtp)) {
    throw new Error('The OTP payload is not valid.');
  }

  if (!/^[A-Za-z0-9 ._-]{1,11}$/.test(normalizedSenderId)) {
    throw new Error('The 251SMS sender ID must be 1 to 11 valid characters.');
  }

  return {
    recipient: normalizeSms251Recipient(phone),
    sender_id: normalizedSenderId,
    type: 'otp',
    message: `Your Serkle verification code is ${normalizedOtp}. Do not share this code.`,
  };
}

export function isSms251Success(
  httpOk: boolean,
  response: Sms251Response | null,
): boolean {
  return httpOk && response?.status?.toLowerCase() === 'success';
}

export function safeSms251ErrorMessage(
  httpStatus: number,
  response: Sms251Response | null,
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

  const providerMessage = response?.message?.trim();
  if (providerMessage && providerMessage.length <= 160) {
    return `The SMS provider rejected the request: ${providerMessage}`;
  }

  return 'The SMS provider could not send the verification code.';
}
