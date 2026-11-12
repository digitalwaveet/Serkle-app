import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { prepareFileForUpload } from '@/utils/prepareFileForUpload';
import { isImageUpload } from '@/lib/imageAsset';
import { uploadImageWithPreviews } from '@/lib/imageStorage';

export interface CreatePostData {
  content: string;
  media?: File[];
  tags?: string[];
  locationText?: string;
  voiceUrl?: string;
  coverImage?: File;
  postType?: 'photo' | 'video' | 'pdf' | 'text';
  originalPdf?: File;
  visibility?: 'public' | 'friends';
}

export const usePostMutations = () => {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const creatingRef = useRef(false);
  const createPost = async (data: CreatePostData, userId: string, requestId?: string) => {
    // React state updates on the next render; this ref closes the same-tick
    // double-click window before any upload or insert starts.
    if (creatingRef.current) return null;
    creatingRef.current = true;
    setIsCreating(true);
    try {
      const idempotencyKey = requestId || crypto.randomUUID();
      let mediaUrls: string[] = [];
      let rootMediaUrl: string | null = null;

      // Handle PDF specifically
      if (data.postType === 'pdf' && data.originalPdf) {
        const file = await prepareFileForUpload(data.originalPdf);
        const fileName = `${userId}/post-${idempotencyKey}.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(fileName, file, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('post-media')
          .getPublicUrl(uploadData.path);
        rootMediaUrl = publicUrl;
      }

      // Upload multiple media files (photos, videos, or PDF page images)
      if (data.media && data.media.length > 0) {
        // Sequential upload and conversion
        for (let i = 0; i < data.media.length; i++) {
          let file = data.media[i];
          if (isImageUpload(file, file.name)) {
            mediaUrls.push(await uploadImageWithPreviews('post-media', userId, file, idempotencyKey));
            continue;
          }
          
          // Pre-process HEIC/HEIF
          file = await prepareFileForUpload(file);
          
          const fileExt = file.name?.split('.').pop() || 'webp';
          const fileName = `${userId}/post-${idempotencyKey}-${i}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('post-media')
            .upload(fileName, file, { upsert: true });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('post-media')
            .getPublicUrl(uploadData.path);
          
          mediaUrls.push(publicUrl);
        }
      }

      let coverImageUrl: string | undefined;
      if (data.coverImage) {
        coverImageUrl = await uploadImageWithPreviews('post-media', userId, data.coverImage, idempotencyKey);
      }

      // Insert post with media_urls array and post_type
      const insertData: any = {
        user_id: userId,
        content: data.content,
        media_url: rootMediaUrl || mediaUrls[0] || null,
        media_urls: mediaUrls,
        cover_image_url: coverImageUrl || null,
        tags: data.tags || [],
        is_sponsored: false,
        post_type: data.postType || (data.media?.length ? 'photo' : 'text'),
        visibility: data.visibility || 'public',
        client_request_id: idempotencyKey,
      };
      if (data.locationText) insertData.location_text = data.locationText;
      if (data.voiceUrl) insertData.voice_url = data.voiceUrl;

      const { data: post, error: postError } = await supabase
        .from('posts')
        .upsert(insertData, { onConflict: 'user_id,client_request_id', ignoreDuplicates: true })
        .select()
        .maybeSingle();

      if (postError) throw postError;
      // An earlier request may have committed even if its response was lost.
      // In that case upsert safely returns no row, so load the original post.
      const createdPost = post || (await supabase
        .from('posts')
        .select()
        .eq('user_id', userId)
        .eq('client_request_id', idempotencyKey)
        .single()).data;
      if (!createdPost) throw new Error('Post could not be confirmed. Please retry.');

      toast({
        title: "Post created",
        description: "Your post has been published successfully.",
      });

      return createdPost;
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Could not confirm your post",
        description: "If your connection dropped, retry the same draft. It will not create a duplicate.",
        variant: "destructive",
      });
      throw error;
    } finally {
      creatingRef.current = false;
      setIsCreating(false);
    }
  };

  const toggleLike = async (postId: string, userId: string, isLiked: boolean, reactionType: string = 'like') => {
    setIsLiking(true);
    try {
      // Determine if we are removing the reaction entirely
      const isRemoving = isLiked && (reactionType === 'like' || !reactionType);

      if (isRemoving) {
        // Unlike/Remove reaction
        const { error } = await supabase
          .from('likes')
          .delete()
          .match({ post_id: postId, user_id: userId });

        if (error) throw error;
      } else {
        // Add or update reaction using upsert for robustness (prevents 409 Conflict)
        const { error } = await supabase
          .from('likes')
          .upsert({
            post_id: postId,
            user_id: userId,
            // @ts-ignore
            reaction_type: reactionType
          }, { onConflict: 'post_id,user_id' });

        if (error) throw error;
      }

      // Automatically invalidate relevant queries to ensure system-wide consistency
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
      queryClient.invalidateQueries({ queryKey: ['circle-posts'] });
      queryClient.invalidateQueries({ queryKey: ['circle-post', postId] });
      return true;
    } catch (error) {
      console.error('Error toggling like/reaction:', error);
      toast({
        title: "Error",
        description: "Failed to update reaction. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLiking(false);
    }
  };

  const toggleSave = async (postId: string, userId: string, isSaved: boolean) => {
    try {
      if (isSaved) {
        // Unsave
        const { error } = await supabase
          .from('saves')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Save
        const { error } = await supabase
          .from('saves')
          .insert({
            post_id: postId,
            user_id: userId,
          });

        if (error) throw error;
      }
      return true;
    } catch (error) {
      console.error('Error toggling save:', error);
      toast({
        title: "Error",
        description: "Failed to update save. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const addComment = async (postId: string, userId: string, content: string, parentId?: string) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: userId,
          content,
          parent_id: parentId || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Comment added",
        description: "Your comment has been posted.",
      });

      return data;
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const incrementShare = async (postId: string) => {
    try {
      // Get current shares count
      const { data: stats } = await supabase
        .from('post_stats')
        .select('shares_count')
        .eq('post_id', postId)
        .single();

      if (stats) {
        const { error } = await supabase
          .from('post_stats')
          .update({ shares_count: stats.shares_count + 1 })
          .eq('post_id', postId);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error incrementing share:', error);
    }
  };

  const deletePost = async (postId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Post deleted",
        description: "Your post has been removed.",
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    createPost,
    toggleLike,
    toggleSave,
    addComment,
    incrementShare,
    deletePost,
    isCreating,
    isLiking,
  };
};
