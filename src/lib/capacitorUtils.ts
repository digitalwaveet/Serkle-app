import { Capacitor } from '@capacitor/core';

/**
 * Returns true if running inside a native Capacitor app (Android or iOS).
 */
export const isNative = (): boolean => Capacitor.isNativePlatform();

/**
 * Returns true if running on Android.
 */
export const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';

/**
 * Returns true if running on iOS.
 */
export const isIOS = (): boolean => Capacitor.getPlatform() === 'ios';

/**
 * Returns true if running in a regular browser (not native).
 */
export const isWeb = (): boolean => Capacitor.getPlatform() === 'web';
