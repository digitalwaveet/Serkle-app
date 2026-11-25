export function buildPostShareUrl(
  postId: string | number,
  origin: string = typeof window !== 'undefined' ? window.location.origin : '',
  circleId?: string | null,
): string {
  const base = origin.replace(/\/+$/, '');
  if (circleId) {
    return `${base}/circle/${circleId}/post/${postId}`;
  }
  return `${base}/post/${postId}`;
}

export function formatPostShareMessage(url: string, authorName?: string | null): string {
  const trimmedAuthor = authorName?.trim();
  return trimmedAuthor
    ? `Check out ${trimmedAuthor}'s post on Serkle: ${url}`
    : `Check out this post on Serkle: ${url}`;
}

export async function copyTextToClipboard(
  text: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined = typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
): Promise<boolean> {
  if (!text) return false;

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback if clipboard permission/context blocks writeText.
    }
  }

  if (doc?.body && typeof doc.execCommand === 'function') {
    const textarea = doc.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    doc.body.appendChild(textarea);
    try {
      textarea.select();
      return Boolean(doc.execCommand('copy'));
    } catch {
      return false;
    } finally {
      doc.body.removeChild(textarea);
    }
  }

  return false;
}

export type NativeShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'error';

export async function shareViaNativeSheet(
  data: ShareData,
  shareFn: ((data: ShareData) => Promise<void>) | undefined = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    ? navigator.share.bind(navigator)
    : undefined,
): Promise<NativeShareOutcome> {
  if (!shareFn) return 'unsupported';
  try {
    await shareFn(data);
    return 'shared';
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError') {
      return 'cancelled';
    }
    return 'error';
  }
}
