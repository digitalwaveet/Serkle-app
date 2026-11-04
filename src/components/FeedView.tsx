import { signProtectedMedia } from '@/lib/protectedMedia';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PostCard from './PostCard';
import { Post } from '@/data/mock';
import { supabase } from '@/integrations/supabase/client';
import { VideoLoader } from '@/components/ui/VideoLoader';
import { useUser } from '@/contexts/UserContext';
import EmptyState from '@/components/ui/empty-state';

const PostSkeleton = () => (<div className="min-h-64 flex items-center justify-center"><SerkleLoader label="Loading posts" showText /></div>);

const PAGE_SIZE = 10;

const formatPost = (item: any): Post => ({
  id: item.post_id,
  user: {
    id: item.user_id,
    name: item.name,
    initials: item.initials,
    avatarColor: item.avatar_color,
    verified: item.is_verified,
    avatar: item.avatar_url,
  },
  time: new Date(item.created_at).toISOString(),
  content: item.content,
  post_type: (item.post_type || (/\.pdf(?:\?|$)/i.test(item.media_url || '') ? 'pdf' : undefined)) as any,
  media: (() => {
    const base = { kind: "image" as const, alt: item.media_alt || '', colorFrom: item.media_color_from || '#4B164C', colorTo: item.media_color_to || '#22194D' };
    // For PDF posts, always use urls array so PostCard's PDF check works
    const isPdf = /\.pdf(?:\?|$)/i.test(item.media_url || '');
    if (isPdf) {
      return { ...base, urls: item.media_urls && item.media_urls.length > 0 ? item.media_urls : [item.media_url].filter(Boolean) as string[] };
    }
    if (item.media_urls && item.media_urls.length > 1) return { ...base, urls: item.media_urls };
    if (item.media_url) return { ...base, url: item.media_url };
    if (item.media_urls && item.media_urls.length === 1) return { ...base, url: item.media_urls[0] };
    if (item.cover_image_url) return { ...base, url: item.cover_image_url };
    return undefined;
  })(),
  tags: item.tags || [],
  stats: {
    likes: item.likes_count || 0,
    comments: item.comments_count || 0,
    shares: item.shares_count || 0,
  },
  sponsored: item.is_sponsored || false,
  userHasLiked: item.user_has_liked || false,
  userReaction: item.user_reaction,
  userHasUnlocked: item.user_has_unlocked || false,
  circleId: item.circle_id || undefined,
  circleName: item.circle_name || undefined,
  circleAvatar: item.circle_avatar_url || undefined,
  isPremium: item.is_premium || false,
  voiceUrl: item.voice_url || undefined,
  locationText: item.location_text || undefined,
  thumbnailUrl: item.cover_image_url || undefined,
  totalMediaCount: item.media_urls ? item.media_urls.length : (item.cover_image_url || item.media_url ? 1 : 0),
  visibility: item.visibility || 'public',
  viewerCanInteract: item.viewer_can_interact !== false,
});

interface FeedViewProps {
  onRefresh?: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({ onRefresh }) => {
  const { user, isLoading: authLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchPosts = useCallback(async (pageNum: number) => {
    try {
      const { data, error } = await supabase.rpc('get_feed_posts', {
        page_num: pageNum,
        page_size: PAGE_SIZE
      });

      if (error) throw error;
      
      const signedData = await signProtectedMedia(data || []);
      const formatted = signedData.map((item: any) => formatPost(item));
      
      if (pageNum === 0) {
        setPosts(formatted);
      } else {
        setPosts(prev => [...prev, ...formatted]);
      }
      setHasMore(formatted.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Wait for auth to settle before the first fetch so we keep showing skeletons
  // (rather than an empty state) during initial load, and refetch once the user
  // becomes available on a fresh sign-in.
  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setPage(0);
    fetchPosts(0);
  }, [authLoading, user?.id, fetchPosts]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage);
  }, [loadingMore, hasMore, page, fetchPosts]);

  useEffect(() => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { rootMargin: '300px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [loading, hasMore, loadingMore, loadMore]);

  return (
    <section aria-labelledby="feed-heading" className="px-0 pt-2 pb-24">
      <h2 id="feed-heading" className="sr-only">Feed</h2>

      {loading || authLoading ? (
        <>
          <PostSkeleton />
        </>
      ) : posts.length ? (
        <>
          {posts.map((post) => <PostCard key={post.id} post={post} />)}
          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-6">
              {loadingMore && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <VideoLoader size="sm" />
                  <span className="text-sm">Loading more posts...</span>
                </div>
              )}
            </div>
          )}
          {!hasMore && posts.length > PAGE_SIZE && (
            <p className="text-center text-xs text-muted-foreground py-4">You're all caught up!</p>
          )}
        </>
      ) : (
        <EmptyState
          title="No Posts Yet"
          description="Be the first to share something amazing."
        />
      )}
    </section>
  );
};
