export type ProfileGender = 'female' | 'male';

export const PROFILE_GENDER_OPTIONS: ReadonlyArray<{ value: ProfileGender; label: string }> = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const DEFAULT_PROFILE_AVATARS: Record<ProfileGender, string> = {
  female: '/illustrations/profile-female.svg',
  male: '/illustrations/profile-male.svg',
};

const PENDING_SIGNUP_GENDER_KEY = 'serkle_pending_signup_gender';

export function normalizeProfileGender(value: unknown): ProfileGender | null {
  return value === 'female' || value === 'male' ? value : null;
}

export function defaultProfileAvatar(gender: unknown): string {
  const normalized = normalizeProfileGender(gender);
  return normalized ? DEFAULT_PROFILE_AVATARS[normalized] : '';
}

/** Uploaded and OAuth photos always take priority over the local illustration. */
export function resolveProfileAvatar(avatar: unknown, gender: unknown): string {
  return typeof avatar === 'string' && avatar.trim()
    ? avatar
    : defaultProfileAvatar(gender);
}

export function savePendingSignupGender(gender: ProfileGender) {
  try {
    sessionStorage.setItem(PENDING_SIGNUP_GENDER_KEY, gender);
  } catch {
    // Storage can be unavailable in private browser modes; signup still works.
  }
}

export function takePendingSignupGender(): ProfileGender | null {
  try {
    const gender = normalizeProfileGender(sessionStorage.getItem(PENDING_SIGNUP_GENDER_KEY));
    sessionStorage.removeItem(PENDING_SIGNUP_GENDER_KEY);
    return gender;
  } catch {
    return null;
  }
}
