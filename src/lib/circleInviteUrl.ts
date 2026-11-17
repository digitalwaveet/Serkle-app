/** Build a Circle invitation URL from the app origin that is currently open. */
export function getCircleInviteUrl(inviteCode: string, origin?: string): string {
  const currentOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const invitePath = `/join/${encodeURIComponent(inviteCode)}`;

  if (!currentOrigin) return invitePath;

  return new URL(invitePath, currentOrigin).toString();
}
