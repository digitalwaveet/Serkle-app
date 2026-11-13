import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { uploadFileWithProgress } from '@/lib/uploadWithProgress';

export type VideoUploadStage = 'preparing' | 'video' | 'thumbnail' | 'saving' | 'complete';

export interface VideoUploadProgress {
  stage: VideoUploadStage;
  percent: number;
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const useVideoMutations = () => {
  const toggleLike = useCallback(async (videoId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login to like videos');
        return;
      }

      // Check if already liked
      const { data: existingLike } = await supabase
        .from('video_likes')
        .select('id')
        .eq('video_id', videoId)
        .eq('user_id', user.id)
        .single();

      if (existingLike) {
        // Unlike
        await supabase
          .from('video_likes')
          .delete()
          .eq('video_id', videoId)
          .eq('user_id', user.id);
      } else {
        // Like
        await supabase
          .from('video_likes')
          .insert({ video_id: videoId, user_id: user.id });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    }
  }, []);

  const toggleSave = useCallback(async (videoId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login to save videos');
        return;
      }

      // Check if already saved
      const { data: existingSave } = await supabase
        .from('video_saves')
        .select('id')
        .eq('video_id', videoId)
        .eq('user_id', user.id)
        .single();

      if (existingSave) {
        // Unsave
        await supabase
          .from('video_saves')
          .delete()
          .eq('video_id', videoId)
          .eq('user_id', user.id);
        toast.success('Video removed from saved');
      } else {
        // Save
        await supabase
          .from('video_saves')
          .insert({ video_id: videoId, user_id: user.id });
        toast.success('Video saved');
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      toast.error('Failed to update save');
    }
  }, []);

  const addComment = useCallback(async (videoId: string, content: string, parentId?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login to comment');
        return;
      }

      const { error } = await supabase
        .from('video_comments')
        .insert({
          video_id: videoId,
          user_id: user.id,
          content,
          parent_id: parentId || null
        });

      if (error) throw error;

      toast.success('Comment added');
      return true;
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
      return false;
    }
  }, []);

  const incrementShare = useCallback(async (videoId: string) => {
    try {
      // First get current count
      const { data: currentStats } = await supabase
        .from('video_stats')
        .select('shares_count')
        .eq('video_id', videoId)
        .single();

      if (currentStats) {
        await supabase
          .from('video_stats')
          .update({ shares_count: (currentStats.shares_count || 0) + 1 })
          .eq('video_id', videoId);
      }
    } catch (error) {
      console.error('Error incrementing share:', error);
    }
  }, []);

  const deleteVideo = useCallback(async (videoId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login to delete videos');
        return;
      }

      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Video deleted');
      return true;
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
      return false;
    }
  }, []);

  const runCreateVideo = useCallback(async (data: {
    video: File;
    thumbnail?: File;
    title: string;
    description?: string;
    tags?: string[];
    uploadId?: string;
    onProgress?: (progress: VideoUploadProgress) => void;
  }) => {
    let videoUrl: string | null = null;
    let userId: string | null = null;
    const uploadedPaths: string[] = [];
    const emit = (stage: VideoUploadStage, percent: number) => data.onProgress?.({
      stage,
      percent: Math.min(100, Math.max(0, Math.round(percent))),
    });

    try {
      emit('preparing', 1);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Please sign in again before publishing your video.');
      }
      userId = user.id;

      const safeName = data.video.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-96) || 'video.mp4';
      const fallbackId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const uploadId = (data.uploadId || globalThis.crypto?.randomUUID?.() || fallbackId).replace(/[^a-zA-Z0-9_-]/g, '');
      const videoFileName = `${user.id}/${uploadId}-${safeName}`;
      const bucket = supabase.storage.from('video-media');
      await uploadFileWithProgress(bucket, videoFileName, data.video, {
        upsert: true,
        onProgress: progress => emit('video', 4 + progress * (data.thumbnail ? 0.8 : 0.88)),
      });
      uploadedPaths.push(videoFileName);

      const { data: { publicUrl: publicVideoUrl } } = supabase.storage
        .from('video-media')
        .getPublicUrl(videoFileName);
      videoUrl = publicVideoUrl;

      // Reconcile a response that was lost after a previous successful save.
      // Reusing the same uploadId makes retries idempotent in this creator session.
      const { data: existingVideo } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .eq('video_url', publicVideoUrl)
        .maybeSingle();
      if (existingVideo) {
        emit('complete', 100);
        toast.success('Video is already published');
        return { success: true, video: existingVideo, reconciled: true };
      }

      // Upload thumbnail if provided
      let thumbnailUrl: string | null = null;
      if (data.thumbnail) {
        const extension = data.thumbnail.type === 'image/png' ? 'png' : 'jpg';
        const thumbnailFileName = `${user.id}/${uploadId}-thumbnail.${extension}`;
        await uploadFileWithProgress(bucket, thumbnailFileName, data.thumbnail, {
          upsert: true,
          onProgress: progress => emit('thumbnail', 84 + progress * 0.11),
        });
        uploadedPaths.push(thumbnailFileName);
        const { data: { publicUrl } } = bucket.getPublicUrl(thumbnailFileName);
        thumbnailUrl = publicUrl;
      }

      // Insert video record
      emit('saving', 96);
      const { data: videoRecord, error: insertError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          video_url: publicVideoUrl,
          thumbnail_url: thumbnailUrl,
          title: data.title,
          description: data.description || null,
          tags: data.tags || []
        })
        .select()
        .single();

      if (insertError) throw insertError;

      emit('complete', 100);
      toast.success('Video uploaded successfully');
      return { success: true, video: videoRecord };
    } catch (error) {
      console.error('Error uploading video:', error);
      // If the insert reached the database but its response was interrupted,
      // recover that record instead of deleting valid media or charging a retry.
      if (videoUrl && userId) {
        const { data: recovered } = await supabase
          .from('videos')
          .select('*')
          .eq('user_id', userId)
          .eq('video_url', videoUrl)
          .maybeSingle();
        if (recovered) {
          emit('complete', 100);
          toast.success('Video uploaded successfully');
          return { success: true, video: recovered, reconciled: true };
        }
      }
      if (uploadedPaths.length) {
        await supabase.storage.from('video-media').remove(uploadedPaths).catch(() => undefined);
      }
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'Video upload was cancelled.'
        : errorMessage(error, 'Video upload failed. Check your connection and retry.');
      toast.error(message);
      return { success: false, error: message };
    }
  }, []);

  const createInFlightRef = useRef<ReturnType<typeof runCreateVideo> | null>(null);
  const createVideo = useCallback((data: Parameters<typeof runCreateVideo>[0]) => {
    if (createInFlightRef.current) return createInFlightRef.current;
    const request = runCreateVideo(data).finally(() => {
      if (createInFlightRef.current === request) createInFlightRef.current = null;
    });
    createInFlightRef.current = request;
    return request;
  }, [runCreateVideo]);

  return {
    toggleLike,
    toggleSave,
    addComment,
    incrementShare,
    deleteVideo,
    createVideo
  };
};
