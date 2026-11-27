export type AuthMethod = 'email' | 'phone';
export type AuthFlowKind = 'signup' | 'recovery';

export interface PendingAuthFlow {
  kind: AuthFlowKind;
  method: AuthMethod;
  identifier: string;
  returnTo: string;
  createdAt: number;
  lastSentAt: number;
}

const E164_PHONE = /^\+[1-9]\d{7,14}$/;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/** Normalize a local or international phone number to E.164. */
export function normalizePhone(value: string, dialCode = '+251') {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const normalizedDialCode = `+${dialCode.replace(/\D/g, '')}`;
  let normalized: string;

  if (compact.startsWith('+')) {
    normalized = `+${compact.slice(1).replace(/\D/g, '')}`;
  } else if (compact.startsWith('00')) {
    normalized = `+${compact.slice(2).replace(/\D/g, '')}`;
  } else {
    const nationalNumber = compact.replace(/\D/g, '').replace(/^0+/, '');
    const dialDigits = normalizedDialCode.slice(1);
    normalized = nationalNumber.startsWith(dialDigits)
      ? `+${nationalNumber}`
      : `${normalizedDialCode}${nationalNumber}`;
  }

  if (!E164_PHONE.test(normalized)) {
    throw new Error('Enter a valid phone number including its country code.');
  }

  return normalized;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

/** Resolve the single login field without changing existing phone identities. */
export function authMethodForIdentifier(value: string): AuthMethod {
  if (isValidEmail(value)) return 'email';

  try {
    normalizePhone(value);
    return 'phone';
  } catch {
    throw new Error('Enter a valid email address or phone number.');
  }
}

export function maskAuthIdentifier(method: AuthMethod, identifier: string) {
  if (method === 'phone') {
    const visibleStart = identifier.slice(0, Math.min(4, identifier.length));
    const visibleEnd = identifier.slice(-3);
    return `${visibleStart}${'•'.repeat(Math.max(4, identifier.length - visibleStart.length - visibleEnd.length))}${visibleEnd}`;
  }

  const [localPart = '', domain = ''] = normalizeEmail(identifier).split('@');
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${'•'.repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

export function authErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return '';
  const code = 'code' in error ? (error as { code?: unknown }).code : '';
  return typeof code === 'string' ? code : '';
}

export function isUnverifiedAuthError(error: unknown) {
  const code = authErrorCode(error);
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return code === 'email_not_confirmed'
    || code === 'phone_not_confirmed'
    || message.includes('email not confirmed')
    || message.includes('phone not confirmed');
}

export function isExistingEmailSignup(
  error: unknown,
  user?: { identities?: readonly unknown[] } | null,
) {
  const code = authErrorCode(error);
  if (code === 'user_already_exists' || code === 'email_exists') return true;

  // With confirmation enabled, Supabase can return an obfuscated user for a
  // duplicate signup. An explicitly empty identity list identifies that result.
  return !error && Array.isArray(user?.identities) && user.identities.length === 0;
}

export function authErrorMessage(error: unknown) {
  const code = authErrorCode(error);
  switch (code) {
    case 'email_not_confirmed':
      return 'Verify your email address before signing in.';
    case 'phone_not_confirmed':
      return 'Verify your phone number before signing in.';
    case 'invalid_credentials':
      return 'The email, phone number or password is incorrect.';
    case 'otp_expired':
      return 'This verification code has expired. Request a new code.';
    case 'over_email_send_rate_limit':
      return 'Too many emails were requested. Wait a moment before trying again.';
    case 'over_sms_send_rate_limit':
      return 'Too many SMS codes were requested. Wait a moment before trying again.';
    case 'over_request_rate_limit':
      return 'Too many attempts were made. Please wait and try again.';
    case 'phone_provider_disabled':
      return 'Phone authentication is not available yet. Please use email for now.';
    case 'email_address_invalid':
      return 'Enter a valid email address.';
    case 'weak_password':
      return 'Choose a stronger password with at least 8 characters.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Something went wrong. Please try again.';
  }
}

