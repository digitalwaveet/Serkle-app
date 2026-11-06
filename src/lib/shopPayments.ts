import type { PaymentMethod } from '../types/cart.ts';

export const SHOP_COIN_PAYMENTS_UNAVAILABLE = 'Shop coin payments are temporarily unavailable. Choose another payment method.';

export function isShopPaymentType(value: unknown): value is PaymentMethod['type'] {
  return value === 'card' || value === 'paypal' || value === 'apple_pay' || value === 'google_pay';
}

export function assertShopPaymentType(value: unknown): asserts value is PaymentMethod['type'] {
  if (!isShopPaymentType(value)) throw new Error(SHOP_COIN_PAYMENTS_UNAVAILABLE);
}
