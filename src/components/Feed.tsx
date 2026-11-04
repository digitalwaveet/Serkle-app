import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PostCard from './PostCard';
import { Post } from '@/data/mock';
import { supabase } from '@/integrations/supabase/client';
import { VideoLoader } from '@/components/ui/VideoLoader';
import EmptyState from '@/components/ui/empty-state';

const PostSkeleton = () => (<div className="min-h-64 flex items-center justify-center"><SerkleLoader label="Loading posts" showText /></div>);

const PAGE_SIZE = 10;

const formatPost = (item: any): Post => ({
  id: item.post_id,
  user: { id: item.user_id, name: item.name, initials: item.initials, avatarColor: item.avatar_color, verified: item.is_verified, avatar: item.avatar_url },
  time: new Date(item.created_at).toISOString(),
  content: item.content,
  post_type: (item.media_url?.toLowerCase().endsWith('.pdf') ? 'pdf' : undefined) as any,
  media: (() => {
    const base = { kind: "image" as const, alt: item.media_alt || '', colorFrom: item.media_color_from || '#4B164C', colorTo: item.media_color_to || '#22194D' };
    // For PDF posts, always use urls array so PostCard's PDF check works
    const isPdf = item.media_url?.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      return { ...base, urls: item.media_urls && item.media_urls.length > 0 ? item.media_urls : [item.media_url].filter(Boolean) as string[] };
    }
    if (item.media_urls && item.media_urls.length > 1) return { ...base, urls: item.media_urls };
    if (item.cover_image_url) return { ...base, url: item.cover_image_url };
    if (item.media_url) return { ...base, url: item.media_url };
    if (item.media_urls && item.media_urls.length === 1) return { ...base, url: item.media_urls[0] };
    return undefined;
  })(),
  tags: item.tags || [],
  stats: { likes: item.likes_count || 0, comments: item.comments_count || 0, shares: item.shares_count || 0 },
  sponsored: item.is_sponsored || false,
  userHasLiked: item.user_has_liked || false,
  userReaction: item.user_reaction,
  circleId: item.circle_id || undefined,
  circleName: item.circle_name || undefined,
  circleAvatar: item.circle_avatar_url || undefined,
  isPremium: item.is_premium || false,
  voiceUrl: item.voice_url || undefined,
  locationText: item.location_text || undefined,
  totalMediaCount: item.media_urls ? item.media_urls.length : (item.cover_image_url || item.media_url ? 1 : 0),
});

const Feed: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPosts = useCallback(async (pageNum: number) => {
    try {
      const { data, error } = await (supabase
        .from('posts')
        .select(`
          post_id:id,
          content,
          media_url,
          media_alt,
          media_color_from,
          media_color_to,
          tags,
          is_sponsored,
          created_at,
          user_id,
          media_urls,
          profiles!inner(name, username, avatar_url, initials, avatar_color, is_verified),
          post_stats(likes_count, comments_count, shares_count, saves_count)
        `)
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1) as any);

      if (error) throw error;
      
      const formatted = (data || []).map((item: any) => formatPost({
        ...item,
        name: item.profiles.name,
        username: item.profiles.username,
        avatar_url: item.profiles.avatar_url,
        initials: item.profiles.initials,
        avatar_color: item.profiles.avatar_color,
        is_verified: item.profiles.is_verified,
        likes_count: item.post_stats?.likes_count || 0,
        comments_count: item.post_stats?.comments_count || 0,
        shares_count: item.post_stats?.shares_count || 0,
        saves_count: item.post_stats?.saves_count || 0,
        user_has_liked: false,
        user_reaction: undefined
      }));
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

  useEffect(() => { fetchPosts(0); }, [fetchPosts]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage);
  }, [loadingMore, hasMore, page, fetchPosts]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [loading, hasMore, loadingMore, loadMore]);

  return (
    <section aria-labelledby="feed-heading" className="px-3 pt-2 pb-24">
      <h2 id="feed-heading" className="sr-only">Feed</h2>
      {loading ? (
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

export default Feed;
