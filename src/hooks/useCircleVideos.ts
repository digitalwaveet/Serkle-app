import { useUser } from '@/contexts/UserContext';
import { purchaseCircleAccess, CIRCLE_ACCESS_QUERY_KEYS } from '@/lib/circlePayments';
import { signProtectedMedia } from '@/lib/protectedMedia';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUpload } from '@/contexts/UploadContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { extractVideoDuration, parseVideoDuration } from '@/lib/videoDuration';
export interface CircleVideo {
  id: string;
  circle_id: string;
  user_id: string;
  playlist_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  title: string;
  description: string | null;
  is_premium: boolean;
  price: number | null;
  duration: string | null;
  views_count: number;
  created_at: string;
  updated_at: string | null;
  user_has_unlocked?: boolean;
  author: {
    name: string;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
    initials: string;
  };
}
export const useCircleVideos = (circleId: string) => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();
  const { addUpload, updateProgress, completeUpload } = useUpload();
  const query = useQuery({
    queryKey: ['circle-videos', circleId, currentUser?.id],
    refetchInterval: 30000,
    staleTime: 0,
    queryFn: async (): Promise<CircleVideo[]> => {
      const { data: rows, error } = await supabase.rpc('get_circle_videos' as any, { _circle_id: circleId });
      if (error) throw error;
      const data = await signProtectedMedia((rows || []) as any[]);
      return (data || []).map((v: any) => ({
        id: v.id,
        circle_id: v.circle_id,
        user_id: v.user_id,
        playlist_id: v.playlist_id,
        video_url: v.video_url,
        thumbnail_url: v.thumbnail_url,
        title: v.title,
        description: v.description,
        is_premium: v.is_premium ?? false,
        price: v.price,
        duration: parseVideoDuration(v.duration)?.toString() ?? null,
        views_count: v.views_count ?? 0,
        created_at: v.created_at,
        updated_at: v.updated_at,
        user_has_unlocked: v.user_has_unlocked === true,
        author: {
          name: v.author?.name || 'Unknown',
          username: v.author?.username || '',
          avatar_url: v.author?.avatar_url,
          avatar_color: v.author?.avatar_color || '#888',
          initials: v.author?.initials || '??',
        },
      }));
    },
    enabled: !!circleId,
  });
  const uploadVideo = useMutation({
    mutationFn: async (params: {
      videoFile: File;
      thumbnailFile?: File;
      title: string;
      description?: string;
      isPremium?: boolean;
      price?: number;
      playlistId?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const ts = Date.now();
      const uploadId = `video-${circleId}-${ts}`;
      
      // Register upload in global context
      addUpload({
        id: uploadId,
        title: params.title,
        circleId
      });

      const durationController = new AbortController();
      try {
        // Extract alongside the upload. Failure leaves metadata unknown; it
        // does not reject an otherwise valid upload or fabricate a duration.
        const durationPromise = extractVideoDuration(params.videoFile, { signal: durationController.signal });
        // Upload video to circle-videos bucket using circleId as folder
        const videoPath = `${circleId}/${ts}.mp4`;
        const { error: videoUploadError } = await supabase.storage
          .from('circle-videos')
          .upload(videoPath, params.videoFile, { 
            cacheControl: '3600', 
            upsert: false,
            onUploadProgress: (progress) => {
              const percent = (progress.loaded / progress.total) * 100;
              updateProgress(uploadId, percent);
            }
          });

        if (videoUploadError) {
          console.error('Upload error:', videoUploadError);
          throw videoUploadError;
        }

        const { data: { publicUrl: videoUrl } } = supabase.storage
          .from('circle-videos')
          .getPublicUrl(videoPath);

        // Upload thumbnail if provided (no progress needed for small thumbs)
        let thumbnailUrl: string | null = null;
        if (params.thumbnailFile) {
          const thumbPath = `${circleId}/${ts}_thumb.jpg`;
          const { error: thumbError } = await supabase.storage
            .from('circle-videos')
            .upload(thumbPath, params.thumbnailFile, { cacheControl: '3600', upsert: false });
          
          if (!thumbError) {
            const { data: { publicUrl } } = supabase.storage
              .from('circle-videos')
              .getPublicUrl(thumbPath);
            thumbnailUrl = publicUrl;
          }
        }

        const durationSeconds = await durationPromise;
        // The existing duration column is text. Store precise seconds, while
        // continuing to accept legacy clock strings on reads.
        // Insert database record
        const { data, error } = await supabase
          .from('circle_videos')
          .insert({
            circle_id: circleId,
            user_id: user.id,
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            title: params.title,
            description: params.description || null,
            is_premium: params.isPremium ?? false,
            price: params.isPremium ? (params.price ?? 50) : null,
            playlist_id: params.playlistId || null,
            duration: durationSeconds?.toString() ?? null,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Finalize success
        completeUpload(uploadId, true);
        return data;
      } catch (error: any) {
        // Finalize error
        completeUpload(uploadId, false, error.message);
        throw error;
      } finally {
        durationController.abort();
      }
    },
    onSuccess: () => {
      toast.success('Video uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: ['circle-videos', circleId] });
    },
    onError: (error: any) => {
      console.error('Upload failed:', error);
      toast.error(error.message || 'Failed to upload video');
    },
  });
  const unlockVideo = useMutation({
    mutationFn: async (videoId: string) => {
      const selected = query.data?.find(v => v.id === videoId);
      if (!selected || !selected.price) throw new Error('Refresh the video price before purchasing');
      return purchaseCircleAccess('video', videoId, { expectedPrice: selected.price });
    },
    onSuccess: () => {
      toast.success('Video unlocked!');
      CIRCLE_ACCESS_QUERY_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unlock video');
    },
  });

  const updateVideo = useMutation({
    mutationFn: async (params: {
      id: string;
      title: string;
      description?: string;
      isPremium?: boolean;
      price?: number;
      playlistId?: string | null;
      thumbnailFile?: File;
    }) => {
      let thumbnailUrl = undefined;
      
      if (params.thumbnailFile) {
        const thumbPath = `${circleId}/${Date.now()}_thumb.jpg`;
        const { error: thumbError } = await supabase.storage
          .from('circle-videos')
          .upload(thumbPath, params.thumbnailFile, { cacheControl: '3600', upsert: false });
        
        if (!thumbError) {
          const { data: { publicUrl } } = supabase.storage
            .from('circle-videos')
            .getPublicUrl(thumbPath);
          thumbnailUrl = publicUrl;
        }
      }

      const { data, error } = await supabase
        .from('circle_videos')
        .update({
          title: params.title,
          description: params.description || null,
          is_premium: params.isPremium ?? false,
          price: params.isPremium ? (params.price ?? 50) : null,
          playlist_id: params.playlistId || null,
          ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Video updated!');
      queryClient.invalidateQueries({ queryKey: ['circle-videos', circleId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update video');
    }
  });

  const deleteVideo = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase
        .from('circle_videos')
        .delete()
        .eq('id', videoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Video deleted');
      queryClient.invalidateQueries({ queryKey: ['circle-videos', circleId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete video');
    }
  });

  return {
    ...query,
    uploadVideo,
    unlockVideo,
    updateVideo,
    deleteVideo,
  };
};
