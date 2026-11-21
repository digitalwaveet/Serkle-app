import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  type AuthMethod,
  type PendingAuthFlow,
  normalizeEmail,
  normalizePhone,
} from '@/lib/authIdentity';
import type { ProfileGender } from '@/lib/profileAvatar';

const PENDING_AUTH_KEY = 'serkle_pending_auth';
const PENDING_AUTH_MAX_AGE_MS = 60 * 60 * 1000;

export interface BeginSignupInput {
  method: AuthMethod;
  email?: string;
  phone?: string;
  dialCode?: string;
  password: string;
  fullName: string;
  gender: ProfileGender;
  returnTo: string;
}

export function authIdentifier(method: AuthMethod, value: string, dialCode = '+251') {
  return method === 'email' ? normalizeEmail(value) : normalizePhone(value, dialCode);
}

export function savePendingAuth(flow: Omit<PendingAuthFlow, 'createdAt' | 'lastSentAt'> & Partial<Pick<PendingAuthFlow, 'createdAt' | 'lastSentAt'>>) {
  const now = Date.now();
  const value: PendingAuthFlow = {
    ...flow,
    createdAt: flow.createdAt ?? now,
    lastSentAt: flow.lastSentAt ?? now,
  };
  sessionStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(value));
  return value;
}

export function loadPendingAuth(expectedKind?: PendingAuthFlow['kind']) {
  try {
    const raw = sessionStorage.getItem(PENDING_AUTH_KEY);
    if (!raw) return null;
    const flow = JSON.parse(raw) as PendingAuthFlow;
    const valid = (flow.method === 'email' || flow.method === 'phone')
      && (flow.kind === 'signup' || flow.kind === 'recovery')
      && typeof flow.identifier === 'string'
      && typeof flow.createdAt === 'number'
      && Date.now() - flow.createdAt <= PENDING_AUTH_MAX_AGE_MS;
    if (!valid || (expectedKind && flow.kind !== expectedKind)) {
      clearPendingAuth();
      return null;
    }
    return flow;
  } catch {
    clearPendingAuth();
    return null;
  }
}

export function clearPendingAuth() {
  sessionStorage.removeItem(PENDING_AUTH_KEY);
}

export async function beginSignup(input: BeginSignupInput) {
  const metadata = {
    name: input.fullName.trim(),
    full_name: input.fullName.trim(),
    gender: input.gender,
  };

  if (input.method === 'email') {
    const email = authIdentifier('email', input.email ?? '');
    const result = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}/verify-account`,
        data: metadata,
      },
    });
    return { ...result, identifier: email };
  }

  const phone = authIdentifier('phone', input.phone ?? '', input.dialCode);
  const result = await supabase.auth.signUp({
    phone,
    password: input.password,
    options: {
      channel: 'sms',
      data: metadata,
    },
  });
  return { ...result, identifier: phone };
}

export async function verifyPendingAuth(flow: PendingAuthFlow, token: string) {
  return verifyAuthOtp(flow.method, flow.identifier, token, flow.kind);
}

export async function verifyAuthOtp(method: AuthMethod, identifier: string, token: string, kind: PendingAuthFlow['kind']) {
  if (method === 'email') {
    return supabase.auth.verifyOtp({
      email: identifier,
      token,
      type: kind === 'recovery' ? 'recovery' : 'email',
    });
  }

  return supabase.auth.verifyOtp({
    phone: identifier,
    token,
    type: 'sms',
  });
}

export async function resendPendingSignup(flow: PendingAuthFlow) {
  if (flow.method === 'email') {
    return supabase.auth.resend({
      type: 'signup',
      email: flow.identifier,
      options: { emailRedirectTo: `${window.location.origin}/verify-account` },
    });
  }

  return supabase.auth.resend({ type: 'sms', phone: flow.identifier });
}

export async function signInWithPassword(method: AuthMethod, value: string, password: string, dialCode = '+251') {
  const identifier = authIdentifier(method, value, dialCode);
  const result = method === 'email'
    ? await supabase.auth.signInWithPassword({ email: identifier, password })
    : await supabase.auth.signInWithPassword({ phone: identifier, password });
  return { ...result, identifier };
}

export async function requestPasswordRecovery(method: AuthMethod, value: string, dialCode = '+251') {
  const identifier = authIdentifier(method, value, dialCode);
  const result = method === 'email'
    ? await supabase.auth.resetPasswordForEmail(identifier, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
    : await supabase.auth.signInWithOtp({
        phone: identifier,
        options: { channel: 'sms', shouldCreateUser: false },
      });
  return { ...result, identifier };
}

export async function updateRecoveredPassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function revokeOtherSessions() {
  return supabase.auth.signOut({ scope: 'others' });
}

export function hasUsableSession(session: Session | null | undefined) {
  return Boolean(session?.access_token && session.user?.id);
}

