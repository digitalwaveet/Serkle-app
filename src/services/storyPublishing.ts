import { supabase } from '@/integrations/supabase/client';
import { EditorExtraData, StoryElement } from '@/types/storyTypes';
import { storyFileExtension, validateStoryFile } from '@/lib/storyMedia';

/** Publication IDs survive retries; editor objects remain untouched on failure. */
export async function publishStory(userId: string, media: Blob, isVideo: boolean, mentions: string[] = [], extra: EditorExtraData = { mediaType: 'image' }) {
  const kind = validateStoryFile(media);
  if ((kind === 'video') !== Boolean(isVideo)) throw new Error('The selected media type does not match this story.');
  const id = extra.publicationId || crypto.randomUUID();
  const { data: existing, error: lookupError } = await supabase.from('stories').select('id').eq('id', id).eq('user_id', userId).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return { id: existing.id, mentionsSaved: true };

  const uploaded: string[] = [];
  const upload = async (blob: Blob, label: string) => {
    const path = `${userId}/${id}/${label}-${crypto.randomUUID()}.${storyFileExtension(blob)}`;
    const { error } = await supabase.storage.from('story-media').upload(path, blob, { contentType: blob.type, cacheControl: '3600', upsert: false });
    if (error) throw error;
    uploaded.push(path);
    return supabase.storage.from('story-media').getPublicUrl(path).data.publicUrl;
  };
  let databaseWriteStarted = false;
  try {
    const mediaUrl = await upload(media, 'media');
    const metadata: unknown[] = [...(extra.stickerData || [])];
    if (extra.overlayBlob) metadata.push({ type: 'overlay', content: await upload(extra.overlayBlob, 'overlay'), x: 0, y: 0 });
    if (extra.videoTransform) metadata.push({ type: 'video_transform', ...extra.videoTransform });
    if (extra.backgroundGradient) metadata.push({ type: 'background_gradient', ...extra.backgroundGradient });
    if (extra.story_state) {
      const elements: StoryElement[] = [];
      for (const original of extra.story_state.elements) {
        const { file, ...element } = original;
        if (file) {
          if (validateStoryFile(file) !== 'image') throw new Error('Photo stickers must be images.');
          element.content = await upload(file, 'sticker');
        } else if (element.type === 'image' && element.content?.startsWith('data:image/')) {
          // Generated share-post cards are rendered locally and must also persist.
          const response = await fetch(element.content);
          const blob = await response.blob();
          validateStoryFile(blob);
          element.content = await upload(blob, 'card');
        } else if (element.content?.startsWith('blob:')) {
          throw new Error('A photo in this story is no longer available. Please add it again.');
        }
        elements.push(element);
      }
      metadata.push({ type: 'story_state', data: { ...extra.story_state,
        background: { ...extra.story_state.background, value: mediaUrl }, elements,
        drawingPaths: extra.story_state.drawingPaths.map(path => ({ ...path, points: path.points.map(point => [...point]) })),
      } });
    }
    databaseWriteStarted = true;
    const { data, error } = await supabase.from('stories').insert({
      id, user_id: userId, media_url: mediaUrl, media_type: kind,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      sticker_data: metadata.length ? metadata : null,
      reshared_post_id: extra.reshared_post_id, reshared_story_id: extra.reshared_story_id,
    } as never).select('id').single();
    if (error) throw error;
    let mentionsSaved = true;
    if (mentions.length) {
      const { error: mentionError } = await supabase.from('story_mentions').insert(
        [...new Set(mentions)].filter(mentionedId => mentionedId !== userId).map(mentionedId => ({ story_id: data.id, mentioned_user_id: mentionedId })));
      mentionsSaved = !mentionError;
    }
    return { id: data.id, mentionsSaved };
  } catch (error) {
    // Only roll back before insert: a lost insert response may already have committed.
    if (!databaseWriteStarted && uploaded.length) {
      try { await supabase.storage.from('story-media').remove(uploaded); } catch { /* best effort; never hide the original error */ }
    }
    throw error;
  }
}
