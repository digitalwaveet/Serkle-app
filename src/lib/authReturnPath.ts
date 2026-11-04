/** Only existing in-app destinations may be used after login (including OAuth). */
export function authReturnPath(search: string) {
  const target = new URLSearchParams(search).get('returnTo') || '';
  if (/^\/share\?draft=[0-9a-f-]{36}$/i.test(target)) return target;
  if (/^\/join\/[a-z0-9_-]+$/i.test(target)) return target;
  if (/^\/verify(?:\?(?:tx_ref|trx_ref|verify_topup)=[a-z0-9_-]+)?$/i.test(target)) return target;
  if (/^\/circle\/[0-9a-f-]{36}(?:\/dashboard|\/post\/[0-9a-f-]{36})?(?:\?tab=[a-z]+)?$/i.test(target)) return target;
  return '/';
}

export function circleLoginPath(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(authReturnPath(`?returnTo=${encodeURIComponent(returnTo)}`))}`;
}
