import { signProtectedMedia } from '@/lib/protectedMedia';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PostCard from './PostCard';
import { Post } from '@/data/mock';
import { supabase } from '@/integrations/supabase/client';
import { VideoLoader } from '@/components/ui/VideoLoader';
import { useUser } from '@/contexts/UserContext';
import EmptyState from '@/components/ui/empty-state';
import { getCirclePostPreviews } from '@/lib/circlePostPreview';
import { CIRCLE_ACCESS_CHANGED_EVENT } from '@/lib/circlePayments';
import { restoreOwnedCirclePostPayloads } from '@/lib/circleOwnerAccess';

const PostSkeleton = () => (<div className="min-h-64 flex items-center justify-center"><SerkleLoader label="Loading posts" showText /></div>);

const PAGE_SIZE = 10;

const addCirclePreviews = async (rows: any[], viewerId?: string) => {
  const isLockedForViewer = (item: any) =>
    Boolean(item.circle_id && item.is_premium && !item.user_has_unlocked && item.user_id !== viewerId);
  const byCircle = new Map<string, { ids: string[]; recoverIds: string[] }>();
  rows.forEach(item => {
    if (!item.circle_id) return;
    const group = byCircle.get(item.circle_id) ?? { ids: [], recoverIds: [] };
    group.ids.push(item.post_id);
    if (isLockedForViewer(item)) group.recoverIds.push(item.post_id);
    byCircle.set(item.circle_id, group);
  });

  if (!byCircle.size) return rows;

  const previewGroups = await Promise.all(
    [...byCircle.entries()].map(([circleId, { ids, recoverIds }]) =>
      getCirclePostPreviews(circleId, ids, false, recoverIds)
    )
  );
  const previews = new Map(previewGroups.flat().map(preview => [preview.post_id, preview]));

  return rows.map(item => {
    if (!item.circle_id) return item;
    const preview = previews.get(item.post_id);
    const headline = preview?.headline;
    if (!isLockedForViewer(item)) return { ...item, circle_headline: headline };
    // Keep the preview separate so it never enters the protected media player.
    return {
      ...item, circle_headline: headline, circle_preview_image: preview?.preview_image,
      content: '', media_url: null, media_urls: [], cover_image_url: null, voice_url: null,
    };
  });
};

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
  circleHeadline: item.circle_headline || undefined,
  circlePreviewImage: item.circle_preview_image || undefined,
  circleName: item.circle_name || undefined,
  circleAvatar: item.circle_avatar_url || undefined,
  isPremium: item.is_premium || false,
  premiumPrice: item.premium_price == null ? undefined : Number(item.premium_price),
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
  const latestFirstPageRequestRef = useRef(0);

  const fetchPosts = useCallback(async (pageNum: number) => {
    const firstPageRequest = pageNum === 0 ? ++latestFirstPageRequestRef.current : null;
    try {
      const { data, error } = await supabase.rpc('get_feed_posts', {
        page_num: pageNum,
        page_size: PAGE_SIZE
      });

      if (error) throw error;
      
      const rowsWithOwnerAccess = await restoreOwnedCirclePostPayloads(data || []);
      const rowsWithPreviews = await addCirclePreviews(rowsWithOwnerAccess, user?.id);
      const signedData = await signProtectedMedia(rowsWithPreviews);
      const formatted = signedData.map((item: any) => formatPost(item));

      // An older locked response must never replace a newer post-unlock fetch.
      if (firstPageRequest !== null && firstPageRequest !== latestFirstPageRequestRef.current) return;
      
      if (pageNum === 0) {
        setPosts(formatted);
      } else {
        setPosts(prev => [...prev, ...formatted]);
      }
      setHasMore(formatted.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      if (firstPageRequest === null || firstPageRequest === latestFirstPageRequestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [user?.id]);

  // Wait for auth to settle before the first fetch so we keep showing skeletons
  // (rather than an empty state) during initial load, and refetch once the user
  // becomes available on a fresh sign-in.
  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setPage(0);
    fetchPosts(0);
  }, [authLoading, user?.id, fetchPosts]);

  useEffect(() => {
    const refreshUnlockedMedia = () => {
      setPage(0);
      void fetchPosts(0);
    };
    window.addEventListener(CIRCLE_ACCESS_CHANGED_EVENT, refreshUnlockedMedia);
    return () => window.removeEventListener(CIRCLE_ACCESS_CHANGED_EVENT, refreshUnlockedMedia);
  }, [fetchPosts]);

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
