export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = globalThis.atob(base64);
  return Uint8Array.from(rawData, character => character.charCodeAt(0));
}

export function pushSubscriptionUsesKey(
  subscription: Pick<PushSubscription, 'options'>,
  expectedPublicKey: string,
): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current || !expectedPublicKey) return false;

  let expected: Uint8Array;
  try {
    expected = urlBase64ToUint8Array(expectedPublicKey);
  } catch {
    return false;
  }

  const actual = new Uint8Array(current);
  if (actual.length !== expected.length) return false;
  return actual.every((byte, index) => byte === expected[index]);
}
