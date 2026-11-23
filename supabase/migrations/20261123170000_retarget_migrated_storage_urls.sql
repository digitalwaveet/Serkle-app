BEGIN;

-- The database backup preserves stable object URLs from the retired project.
-- Retarget only that exact origin; object keys, ownership and access policies do
-- not change. Private buckets remain private and are signed by frontend readers.
DO $$
DECLARE
  old_origin constant text := 'https://zewcewkqruxlniavsrgj.supabase.co';
  new_origin constant text := 'https://fkeyentcklsuqecqgmak.supabase.co';
BEGIN
  UPDATE public.circle_videos SET
    video_url = replace(video_url, old_origin, new_origin),
    thumbnail_url = replace(thumbnail_url, old_origin, new_origin)
  WHERE video_url LIKE old_origin || '/%' OR thumbnail_url LIKE old_origin || '/%';

  UPDATE public.circles SET
    avatar_url = replace(avatar_url, old_origin, new_origin),
    cover_image_url = replace(cover_image_url, old_origin, new_origin)
  WHERE avatar_url LIKE old_origin || '/%' OR cover_image_url LIKE old_origin || '/%';

  UPDATE public.conversations SET group_avatar_url = replace(group_avatar_url, old_origin, new_origin)
  WHERE group_avatar_url LIKE old_origin || '/%';

  UPDATE public.messages SET attachment_url = replace(attachment_url, old_origin, new_origin)
  WHERE attachment_url LIKE old_origin || '/%';

  UPDATE public.posts SET
    media_url = replace(media_url, old_origin, new_origin),
    cover_image_url = replace(cover_image_url, old_origin, new_origin),
    voice_url = replace(voice_url, old_origin, new_origin),
    original_pdf_url = replace(original_pdf_url, old_origin, new_origin),
    media_urls = ARRAY(
      SELECT replace(item, old_origin, new_origin)
      FROM unnest(COALESCE(media_urls, '{}'::text[])) WITH ORDINALITY AS source(item, position)
      ORDER BY position
    )
  WHERE media_url LIKE old_origin || '/%'
     OR cover_image_url LIKE old_origin || '/%'
     OR voice_url LIKE old_origin || '/%'
     OR original_pdf_url LIKE old_origin || '/%'
     OR EXISTS (SELECT 1 FROM unnest(COALESCE(media_urls, '{}'::text[])) item WHERE item LIKE old_origin || '/%');

  UPDATE public.profiles SET
    avatar_url = replace(avatar_url, old_origin, new_origin),
    cover_image_url = replace(cover_image_url, old_origin, new_origin)
  WHERE avatar_url LIKE old_origin || '/%' OR cover_image_url LIKE old_origin || '/%';

  UPDATE public.shop_items SET images = ARRAY(
    SELECT replace(item, old_origin, new_origin)
    FROM unnest(images) WITH ORDINALITY AS source(item, position)
    ORDER BY position
  )
  WHERE EXISTS (SELECT 1 FROM unnest(images) item WHERE item LIKE old_origin || '/%');

  UPDATE public.stories SET
    media_url = replace(media_url, old_origin, new_origin),
    sticker_data = CASE WHEN sticker_data::text LIKE '%' || old_origin || '%'
      THEN replace(sticker_data::text, old_origin, new_origin)::jsonb ELSE sticker_data END
  WHERE media_url LIKE old_origin || '/%' OR sticker_data::text LIKE '%' || old_origin || '%';

  UPDATE public.videos SET
    video_url = replace(video_url, old_origin, new_origin),
    thumbnail_url = replace(thumbnail_url, old_origin, new_origin)
  WHERE video_url LIKE old_origin || '/%' OR thumbnail_url LIKE old_origin || '/%';
END $$;

COMMIT;
