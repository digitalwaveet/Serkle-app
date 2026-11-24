export type CreatePostType = 'photo' | 'video' | 'pdf' | 'text';

export function createPostType(
  media: readonly { kind: string }[],
  hasPdf: boolean,
): CreatePostType {
  if (hasPdf) return 'pdf';
  if (media.some(item => item.kind === 'video')) return 'video';
  return media.length > 0 ? 'photo' : 'text';
}

export function canPublishPostDraft(input: {
  text: string;
  mediaCount: number;
  hasPdf: boolean;
  hasVoice: boolean;
  creating: boolean;
  shareReady: boolean;
}) {
  const hasContent = Boolean(
    input.text.trim() || input.mediaCount || input.hasPdf || input.hasVoice,
  );
  return hasContent && !input.creating && input.shareReady;
}

export function fileRevision(file: Blob) {
  return file instanceof File ? file.lastModified : 0;
}
