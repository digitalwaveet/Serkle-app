export { copyTextToClipboard, shareViaNativeSheet, type NativeShareOutcome } from './postShare.ts';

export function buildVideoShareUrl(
  videoId: string | number,
  origin: string = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/video/${videoId}`;
}

export function formatVideoShareMessage(url: string, title?: string | null): string {
  const trimmedTitle = title?.trim();
  return trimmedTitle
    ? `Check out "${trimmedTitle}" on Serkle: ${url}`
    : `Check out this video! ${url}`;
}
