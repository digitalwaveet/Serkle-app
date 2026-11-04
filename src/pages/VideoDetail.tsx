import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Video } from '@/hooks/useVideoFeed';
import { UnifiedVideoPlayer } from '@/components/UnifiedVideoPlayer';
import { ArrowLeft } from 'lucide-react';
import { VideoLoader } from '@/components/ui/VideoLoader';

const VideoDetail: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideo = async () => {
      if (!videoId) return;
      try {
        const { data, error: fetchError } = await supabase.rpc('get_video_feed', {
          page_num: 0,
          page_size: 100,
        });

        if (fetchError) throw fetchError;

        const found = (data || []).find((v: any) => v.video_id === videoId);
        if (!found) {
          setError('Video not found');
          return;
        }

        setVideo({
          id: found.video_id,
          user: {
            id: found.user_id,
            username: found.username,
            name: found.name,
            initials: found.initials,
            avatar: found.avatar_url || '',
            avatarColor: found.avatar_color,
            verified: found.is_verified,
          },
          url: found.video_url,
          thumbnail: found.thumbnail_url,
          title: found.title,
          description: found.description,
          tags: found.tags || [],
          stats: {
            likes: found.likes_count,
            comments: found.comments_count,
            shares: found.shares_count,
            saves: found.saves_count,
            views: found.views_count,
          },
          liked: found.user_has_liked,
          saved: found.user_has_saved,
          createdAt: found.created_at,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [videoId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <VideoLoader size="lg" dark />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <p>{error || 'Video not found'}</p>
        <button onClick={() => navigate('/')} className="text-primary underline">
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <UnifiedVideoPlayer video={video} isActive={true} index={0} />
    </div>
  );
};

export default VideoDetail;
