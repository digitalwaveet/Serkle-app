/** Only existing in-app destinations may be used after login (including OAuth). */
export function authReturnPath(search: string) {
  const target = new URLSearchParams(search).get("returnTo") || "";
  if (
    !target.startsWith("/")
    || target.startsWith("//")
    || target.includes("\\")
    || target.includes("..")
    || /[?&]returnTo=/i.test(target)
  ) return "/";

  if (/^\/share\?draft=[0-9a-f-]{36}$/i.test(target)) return target;
  if (/^\/join\/[a-z0-9_-]+$/i.test(target)) return target;
  if (
    /^\/verify(?:\?(?:tx_ref|trx_ref|verify_topup)=[a-z0-9_-]+)?$/i.test(target)
  )
    return target;
  if (
    /^\/messages(?:\/[0-9a-f-]{36})?(?:\?(?:invite|userId|messageId)=[0-9a-f-]{36})?$/i.test(
      target,
    )
  )
    return target;
  if (
    /^\/circle\/[0-9a-f-]{36}(?:\/dashboard|\/post\/[0-9a-f-]{36})?(?:\?tab=[a-z]+)?$/i.test(
      target,
    )
  )
    return target;
  if (/^\/(?:notifications|shop|cart|orders|wishlist|disputes|shipping-addresses|ask|test-push)(?:\?[a-z0-9_=&%.-]+)?$/i.test(target)) return target;
  if (/^\/create\/(?:post|video|circle|shop)$/i.test(target)) return target;
  if (/^\/(?:post|video|order|seller)\/[0-9a-f-]{36}$/i.test(target)) return target;
  if (/^\/shop\/product\/[0-9a-f-]{36}$/i.test(target)) return target;
  if (/^\/shop\/messages(?:\/[0-9a-f-]{36})?$/i.test(target)) return target;
  if (/^\/ask\/(?:profile|question\/[0-9a-f-]{36})$/i.test(target)) return target;
  if (/^\/profile\/[a-z0-9_.-]+$/i.test(target)) return target;
  if (/^\/sos\/[a-z0-9_-]+$/i.test(target)) return target;
  if (/^\/seller\/dashboard$/i.test(target)) return target;
  return "/";
}

export function circleLoginPath(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(authReturnPath(`?returnTo=${encodeURIComponent(returnTo)}`))}`;
}
