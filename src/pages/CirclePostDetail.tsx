import { purchaseCircleAccess, confirmCirclePostAccess, refreshCircleAccessQueries } from '@/lib/circlePayments';
import { useCircleSubscription } from '@/hooks/useCircleSubscription';
import { signProtectedMedia } from '@/lib/protectedMedia';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { OriginalImageDownload } from '@/components/ui/OriginalImageDownload';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Share2, Bookmark, Lock, Send } from 'lucide-react';
import DOMPurify from 'dompurify';
import { CircleLockedCover, CirclePremiumBadge, CirclePreviewFade } from '@/components/circles/CirclePostPreview';
import { SubscribeCircleModal } from '@/components/circles/SubscribeCircleModal';
import { getCirclePostPreviews } from '@/lib/circlePostPreview';
import { Button } from '@/components/ui/button';
import { TipButton } from '@/components/circles/TipButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { useUser } from '@/contexts/UserContext';
import { Input } from '@/components/ui/input';
import EmojiPicker from '@/components/EmojiPicker';
import { GiftEmojiPicker, GiftEmoji } from '@/components/GiftEmojiPicker';
import MiniGiftAnimation from '@/components/post/MiniGiftAnimation';
import GiftCommentCard from '@/components/post/GiftCommentCard';
import {
  formatGiftCommentContent,
  parseGiftComment,
  getGiftAnimationTier,
  savePendingGiftComment,
  getPendingGiftCommentsForPost,
  finalizePendingGiftComment,
  flushPendingGiftCommentKeepalive,
  PendingGiftCommentRecord,
} from '@/lib/giftComment';
import PostReactionButton from '@/components/post/PostReactionButton';
import ShareIcon from '@/components/post/ShareIcon';
import LikersModal from '@/components/LikersModal';
import { PDFCarousel } from '@/components/post/PDFCarousel';

// Comments component for circle posts
const CirclePostComments: React.FC<{
  postId: string;
  commentsCount: number;
  isOpen: boolean;
  recipientId?: string;
  recipientName?: string;
}> = ({ postId, commentsCount, isOpen, recipientId, recipientName }) => {
  const [newComment, setNewComment] = useState('');
  const [activeGiftAnimation, setActiveGiftAnimation] = useState<PendingGiftCommentRecord | null>(null);
  const [isGiftSending, setIsGiftSending] = useState(false);
  const giftInFlightRef = useRef(false);
  const giftFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeGiftRecordRef = useRef<PendingGiftCommentRecord | null>(null);
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { transferCoins } = useCoinWallet(user?.id);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['circle-post-comments', postId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_post_comments', { _post_id: postId });
      if (error) throw error;
      return data || [];
    },
    enabled: !!postId,
  });

  // Real-time subscription for new circle post comments
  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`circle-comments-realtime-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['circle-post-comments', postId] });
          queryClient.invalidateQueries({ queryKey: ['circle-post', postId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);

  // Recover any unfinalized paid gift comments for this circle post
  useEffect(() => {
    if (!postId || !user) return;
    const pendingList = getPendingGiftCommentsForPost(postId);
    if (pendingList.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const pending of pendingList) {
        if (cancelled) break;
        if (activeGiftRecordRef.current?.transactionId === pending.transactionId) continue;
        const result = await finalizePendingGiftComment(pending, user.id);
        if (result && !cancelled) {
          queryClient.invalidateQueries({ queryKey: ['circle-post-comments', postId] });
          queryClient.invalidateQueries({ queryKey: ['circle-post', postId] });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postId, user?.id, queryClient]);

  // Flush active pending gift comment if user closes the tab mid-animation
  useEffect(() => {
    const flushActiveGift = () => {
      const record = activeGiftRecordRef.current;
      if (!record || !user) return;
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token;
        if (token) {
          flushPendingGiftCommentKeepalive(record, user.id, token);
        } else {
          finalizePendingGiftComment(record, user.id);
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && activeGiftRecordRef.current) {
        flushActiveGift();
      }
    };

    window.addEventListener('pagehide', flushActiveGift);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushActiveGift);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (giftFallbackTimerRef.current) {
        clearTimeout(giftFallbackTimerRef.current);
      }
    };
  }, [user?.id]);

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase.from('comments').insert({
        post_id: postId,
        user_id: user.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['circle-post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['circle-post', postId] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add comment', description: error.message, variant: 'destructive' });
    },
  });

  const handleGiftSelect = async (gift: GiftEmoji): Promise<void> => {
    if (!user || !postId || !recipientId) {
      toast({ title: 'Sign in required', description: 'Please sign in to send gifts', variant: 'destructive' });
      return;
    }
    if (giftInFlightRef.current || isGiftSending) return;

    giftInFlightRef.current = true;
    setIsGiftSending(true);

    const requestId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `gift-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const txResult = await transferCoins.mutateAsync({
        receiverId: recipientId,
        amount: gift.value,
        typeSent: 'tip_sent',
        typeReceived: 'tip_received',
        referenceId: postId,
        description: `Sent ${gift.emoji} ${gift.label} gift on comment`,
        requestId,
      });

      const transactionId = String((txResult as any)?.requestId || requestId);
      const content = formatGiftCommentContent({
        giftId: gift.id,
        name: gift.label,
        emoji: gift.emoji,
        image: gift.image,
        quantity: gift.quantity || 1,
        value: gift.value,
        senderId: user.id,
        senderName: user.name,
        transactionId,
      });

      const pendingRecord: PendingGiftCommentRecord = {
        requestId,
        transactionId,
        postId,
        targetType: 'post',
        userId: user.id,
        userName: user.name,
        giftId: gift.id,
        giftName: gift.label,
        giftEmoji: gift.emoji,
        giftImage: gift.image,
        quantity: gift.quantity || 1,
        coinValue: gift.value,
        content,
        createdAt: Date.now(),
      };

      savePendingGiftComment(pendingRecord);
      activeGiftRecordRef.current = pendingRecord;
      setActiveGiftAnimation(pendingRecord);

      const { durationMs } = getGiftAnimationTier(gift.value);
      if (giftFallbackTimerRef.current) clearTimeout(giftFallbackTimerRef.current);
      giftFallbackTimerRef.current = setTimeout(async () => {
        if (activeGiftRecordRef.current?.transactionId === pendingRecord.transactionId) {
          await finalizePendingGiftComment(pendingRecord, user.id);
          queryClient.invalidateQueries({ queryKey: ['circle-post-comments', postId] });
          queryClient.invalidateQueries({ queryKey: ['circle-post', postId] });
          activeGiftRecordRef.current = null;
          setActiveGiftAnimation(null);
          giftInFlightRef.current = false;
          setIsGiftSending(false);
        }
      }, durationMs + 450);
    } catch (error: any) {
      giftInFlightRef.current = false;
      setIsGiftSending(false);
      toast({
        title: 'Failed to send gift',
        description: error?.message || 'Unable to process gift transaction',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!user) {
      toast({ title: 'Please log in to comment', variant: 'destructive' });
      return;
    }
    addComment.mutate(newComment.trim());
  };

  return (
    <div
      id="circle-post-comments"
      className={cn(
        "mt-12 scroll-mt-20 border-t border-border pt-8 engagement-comment-panel relative",
        !isOpen && "hidden"
      )}
    >
      <h2 className="text-2xl font-bold text-foreground mb-6">
        Comments ({commentsCount})
      </h2>

      {/* Comment input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-6">
        {user && (
          <Avatar className="size-8 flex-shrink-0">
            <AvatarImage src={user.avatar} />
            <AvatarFallback className="text-xs" style={{ backgroundColor: user.avatarColor }}>
              {user.initials}
            </AvatarFallback>
          </Avatar>
        )}
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={user ? "Write a comment..." : "Log in to comment"}
          disabled={!user || addComment.isPending}
          className="flex-1"
        />
        <EmojiPicker 
          onEmojiSelect={(emoji) => setNewComment(prev => prev + emoji)}
          variant="compact"
        />
        {recipientId && user?.id !== recipientId && (
          <GiftEmojiPicker
            onGiftSelect={handleGiftSelect}
            recipientId={recipientId}
            recipientName={recipientName}
            isSending={isGiftSending}
          />
        )}
        <Button
          type="submit"
          size="icon"
          disabled={!newComment.trim() || !user || addComment.isPending}
          className="flex-shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </form>

      {/* Comments list */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment: any) => {
            const giftMeta = parseGiftComment(comment.content);
            const isRecent = Date.now() - new Date(comment.created_at).getTime() < 60_000;
            const timeLabel = isRecent
              ? 'Just now'
              : new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div key={comment.comment_id} className="flex gap-3">
                <Avatar className="size-8 flex-shrink-0">
                  <AvatarImage src={comment.avatar_url} />
                  <AvatarFallback className="text-xs" style={{ backgroundColor: comment.avatar_color }}>
                    {comment.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-semibold text-sm text-foreground">{comment.name}</span>
                    <span className="text-xs text-muted-foreground">· {timeLabel}</span>
                  </div>
                  {giftMeta ? (
                    <GiftCommentCard metadata={giftMeta} className="mt-1" />
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">{comment.content}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeGiftAnimation && (
        <MiniGiftAnimation
          giftId={activeGiftAnimation.giftId}
          name={activeGiftAnimation.giftName}
          emoji={activeGiftAnimation.giftEmoji}
          image={activeGiftAnimation.giftImage}
          quantity={activeGiftAnimation.quantity}
          coinValue={activeGiftAnimation.coinValue}
          onComplete={async () => {
            const record = activeGiftRecordRef.current || activeGiftAnimation;
            if (giftFallbackTimerRef.current) {
              clearTimeout(giftFallbackTimerRef.current);
              giftFallbackTimerRef.current = null;
            }
            activeGiftRecordRef.current = null;
            setActiveGiftAnimation(null);

            if (record && user) {
              await finalizePendingGiftComment(record, user.id);
              queryClient.invalidateQueries({ queryKey: ['circle-post-comments', postId] });
              queryClient.invalidateQueries({ queryKey: ['circle-post', postId] });
              toast({
                title: `${record.giftEmoji} ${record.giftName} gift sent!`,
                description: `You sent ${record.coinValue.toLocaleString()} coins to ${recipientName || 'creator'}`,
              });
            }
            giftInFlightRef.current = false;
            setIsGiftSending(false);
          }}
        />
      )}
    </div>
  );
};


const CirclePostDetail: React.FC = () => {
  const { circleId, postId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [saveAnim, setSaveAnim] = useState<'idle' | 'save' | 'unsave'>('idle');
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const unlocking = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likeInFlightRef = useRef(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const { user } = useUser();
  const { wallet } = useCoinWallet(user?.id);
  const { data: subscription } = useCircleSubscription(circleId);
  const hasActiveSubscription = !!subscription;
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticLikesCount, setOptimisticLikesCount] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Fetch circle details
  const { data: circle } = useQuery({
    queryKey: ['circle', circleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('circles')
        .select('*')
        .eq('id', circleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!circleId,
  });

  // Fetch post details
  const { data: post, isLoading, isError: isAccessError, refetch: retryAccess } = useQuery({
    queryKey: ['circle-post', postId, user?.id, circleId],
    refetchInterval: 30000,
    staleTime: 0,
    queryFn: async () => {
      // Use the SECURITY DEFINER RPC (same as PostDetail) instead of a direct
      // table read. A direct `.from('posts')...single()` is filtered by RLS for
      // locked premium posts and returns 0 rows → PostgREST 406, which broke the
      // page (and therefore the unlock flow). The RPC returns the row plus the
      // viewer-specific flags (user_has_unlocked / user_has_liked) for any post.
      const { data: rows, error } = await supabase.rpc('get_post_details', { _post_id: postId });
      if (error) throw error;
      const source = rows?.[0];
      if (!source || !circleId || source.circle_id !== circleId) throw new Error('Post not found');
      const [row, previews] = await Promise.all([
        signProtectedMedia(source),
        getCirclePostPreviews(
          circleId,
          [source.post_id],
          !!source.is_premium && !source.user_has_unlocked,
          source.is_premium && !source.user_has_unlocked ? [source.post_id] : [],
        ),
      ]);

      // Tip count (separate aggregate query — must never fail unlock verification).
      const { count: tipCount } = await supabase
        .from('circle_tips')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)
        .then((res) => (res.error ? { count: 0 } : res), () => ({ count: 0 }));

      const author = {
        id: row.user_id,
        name: row.name,
        username: row.username,
        avatar_url: row.avatar_url,
        initials: row.initials,
        avatar_color: row.avatar_color,
      };
      const stats = {
        likes_count: row.likes_count ?? 0,
        comments_count: row.comments_count ?? 0,
        shares_count: row.shares_count ?? 0,
      };

      return {
        ...row,
        preview: previews[0],
        coverReference: source.cover_image_url || (source.post_type === 'photo' ? source.media_url : null),
        author,
        profiles: author,
        stats,
        post_stats: stats,
        user_has_liked: row.user_has_liked ?? false,
        user_reaction: row.user_reaction ?? null,
        tip_count: tipCount || 0,
        user_has_unlocked: row.user_has_unlocked ?? false,
      };
    },
    enabled: !!postId,
  });

  useEffect(() => {
    if (post) {
      setOptimisticLiked(post.user_has_liked);
      setOptimisticLikesCount(post.stats?.likes_count ?? 0);
    }
  }, [post?.user_has_liked, post?.stats?.likes_count]);

  const isOwner = !!user && (user.id === circle?.creator_id || user.id === post?.user_id);
  const shouldShowPaywall = !!post?.is_premium && !post.user_has_unlocked;

  const syncedSubPostRef = useRef<string | null>(null);
  useEffect(() => {
    if ((hasActiveSubscription || isOwner) && post?.post_id && post.is_premium && !post.user_has_unlocked && syncedSubPostRef.current !== post.post_id) {
      syncedSubPostRef.current = post.post_id;
      retryAccess();
    }
  }, [hasActiveSubscription, isOwner, post?.post_id, post?.is_premium, post?.user_has_unlocked, retryAccess]);

  useEffect(() => {
    if (post?.post_id && !shouldShowPaywall && !isAccessError && state?.openComments) {
      setCommentsOpen(true);
      document.getElementById('circle-post-comments')?.scrollIntoView();
    }
  }, [post?.post_id, shouldShowPaywall, isAccessError, state]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SerkleLoader size="md" className="text-current" />
      </div>
    );
  }

  if (isAccessError) return <div className="p-6 text-center"><p>Could not verify access.</p><Button onClick={() => retryAccess()}>Retry</Button></div>;

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Post not found</h1>
          <p className="text-muted-foreground mb-4">The post you're looking for doesn't exist.</p>
          <Button onClick={() => navigate(`/circle/${circleId}`)}>
            Back to Circle
          </Button>
        </div>
      </div>
    );
  }

  const handleUnlock = async () => {
    if (unlocking.current || !post.premium_price || post.premium_price <= 0) return;
    if (!user) {
      toast({ title: "Please log in to unlock", variant: "destructive" });
      return;
    }
    unlocking.current = true;
    setIsUnlocking(true);
    try {
      const result = await purchaseCircleAccess('post', postId!, {
        expectedPrice: post.premium_price,
        deferConfirmation: true,
      });
      const verification = await confirmCirclePostAccess(postId!);
      if (!verification.confirmed) {
        await refreshCircleAccessQueries(queryClient, { circleId, postId });
        const latest = await retryAccess();
        if (latest.error || !latest.data?.user_has_unlocked) {
          toast({
            title: 'Access is still syncing',
            description: 'Your payment reference was kept safely. Retry this button to restore access without another charge.',
            variant: 'destructive',
          });
          return;
        }
      }
      result.confirm();
      await refreshCircleAccessQueries(queryClient, { circleId, postId });
      toast({
        title: 'Post unlocked',
        description: result.charged
          ? `${result.charged} coins paid. Full post access is ready.`
          : result.recovered
            ? 'Your previous payment was restored. No additional coins were charged.'
            : 'Included in your existing access.',
      });
    } catch (error: any) {
      toast({ title: "Unlock failed", description: error.message, variant: "destructive" });
    } finally {
      unlocking.current = false;
      setIsUnlocking(false);
    }
  };

  const currentLiked = optimisticLiked ?? post.user_has_liked;
  const currentLikesCount = optimisticLikesCount ?? (post.stats?.likes_count || 0);

  const handleLike = async (reactionType: string = 'like') => {
    if (likeInFlightRef.current) return;
    if (!user) {
      toast({ title: "Please log in to like posts", variant: "destructive" });
      return;
    }
    likeInFlightRef.current = true;

    const wasLiked = currentLiked;
    const prevCount = currentLikesCount;
    const isRemoving = wasLiked && (reactionType === 'like' || !reactionType);
    const willBeLiked = !isRemoving;

    setOptimisticLiked(willBeLiked);
    if (!wasLiked && willBeLiked) setOptimisticLikesCount(prevCount + 1);
    else if (wasLiked && !willBeLiked) setOptimisticLikesCount(Math.max(0, prevCount - 1));

    try {
      if (isRemoving) {
        const { error } = await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
      } else {
        // Use upsert to prevent 409 Conflict and ensure post owner persistence
        // @ts-ignore
        const { error } = await supabase.from('likes').upsert({
          post_id: postId,
          user_id: user.id,
          reaction_type: reactionType
        }, { onConflict: 'post_id,user_id' });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['circle-post', postId] });
      // Also invalidate the circle feed to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['circle-posts', circleId] });
    } catch (error: any) {
      setOptimisticLiked(wasLiked);
      setOptimisticLikesCount(prevCount);
      toast({ title: "Failed to like post", description: error.message, variant: "destructive" });
    } finally {
      likeInFlightRef.current = false;
    }
  };

  const handleToggleBookmark = () => {
    const next = !isBookmarked;
    setIsBookmarked(next);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (next) {
      setSaveAnim('save');
      saveTimerRef.current = setTimeout(() => setSaveAnim('idle'), 260);
    } else {
      setSaveAnim('unsave');
      saveTimerRef.current = setTimeout(() => setSaveAnim('idle'), 180);
    }
  };

  const handleTip = async (amount: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please log in to tip", variant: "destructive" });
        return;
      }

      await supabase.from('circle_tips').insert({
        post_id: postId,
        tipper_id: user.id,
        recipient_id: post.user_id,
        amount,
      });

      queryClient.invalidateQueries({ queryKey: ['circle-post', postId] });
      toast({ title: "Tip sent successfully!", description: `You tipped ${amount} coins` });
    } catch (error: any) {
      toast({ title: "Failed to send tip", description: error.message, variant: "destructive" });
    }
  };

  const content = shouldShowPaywall ? '' : post.content ?? '';
  const isRichText = /<[a-z][\s\S]*>/i.test(content);
  const cover = post.coverReference;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate(`/circle/${circleId}`)}
            aria-label="Back to Circle"
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <h1 className="font-semibold text-lg">{circle?.name || 'Post'}</h1>
            {post.is_premium && <CirclePremiumBadge locked={shouldShowPaywall} />}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <article className={cn('mx-auto max-w-3xl', shouldShowPaywall && 'rounded-[20px] border border-border bg-card p-4 shadow-soft sm:p-6')}>
          {!shouldShowPaywall && post.post_type === 'pdf' && !!post.media_urls?.length && (
            <PDFCarousel pages={post.media_urls} className="mb-6 aspect-[4/5] shadow-lg" />
          )}

          {!shouldShowPaywall && cover && post.post_type !== 'pdf' && (
            <div className="relative mb-5">
              <OptimizedImage src={cover} alt="Post cover" className="w-full rounded-2xl object-cover" imageClassName="object-cover" size="full" style={{ aspectRatio: '2.24' }} />
              <OriginalImageDownload src={cover} />
            </div>
          )}

          {/* Post Header */}
          <div className="mb-6">
            {/* Author info */}
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="size-12">
                <AvatarImage src={post.author.avatar_url} />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground" style={{ backgroundColor: post.author.avatar_color }}>
                  {post.author.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{post.author.name}</span>
                  {isOwner && (
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      Owner
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(post.created_at).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleBookmark}
                aria-label={isBookmarked ? 'Unsave post' : 'Save post'}
                aria-pressed={isBookmarked}
                className={cn(
                  "engagement-btn engagement-btn--icon-only",
                  isBookmarked && "engagement-btn--saved"
                )}
              >
                <Bookmark
                  strokeWidth={1.85}
                  className={cn(
                    "engagement-icon",
                    isBookmarked ? "engagement-bookmark--saved" : "engagement-bookmark--unsaved",
                    saveAnim === 'save' && "engagement-bookmark--anim-save",
                    saveAnim === 'unsave' && "engagement-bookmark--anim-unsave"
                  )}
                />
              </button>
            </div>

            {/* Interaction buttons */}
            {!shouldShowPaywall && (
            <div className="flex flex-wrap items-center gap-2 border-y border-border py-2">
              <PostReactionButton
                isLiked={currentLiked}
                likesCount={currentLikesCount}
                userReaction={post.user_reaction}
                onLike={handleLike}
                onShowLikers={() => setShowLikersModal(true)}
              />
              
              <button
                type="button"
                onClick={() => {
                  setCommentsOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      requestAnimationFrame(() => {
                        document.getElementById('circle-post-comments')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      });
                    }
                    return next;
                  });
                }}
                aria-label="Comments"
                aria-expanded={commentsOpen}
                className={cn(
                  "engagement-btn",
                  commentsOpen && "engagement-btn--comment-active"
                )}
              >
                <MessageCircle strokeWidth={1.85} className="engagement-icon" />
                <span className="engagement-count">{post.stats?.comments_count || 0}</span>
              </button>
              
              <button
                type="button"
                onClick={async () => {
                  if (navigator.share) {
                    try { await navigator.share({ url: window.location.href }); } catch {}
                  } else if (navigator.clipboard) {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      toast({ title: 'Link copied' });
                    } catch {}
                  }
                }}
                aria-label="Share"
                className="engagement-btn"
              >
                <ShareIcon strokeWidth={1.85} className="engagement-icon" />
                <span className="engagement-count">{post.stats?.shares_count || 0}</span>
              </button>

              {user && user.id !== post.user_id && post.preview?.has_tips_enabled && (
                <TipButton
                  postId={postId!}
                  authorName={post.author.name}
                  tipCount={post.tip_count || 0}
                  userHasTipped={false}
                  onTip={handleTip}
                  variant="card"
                />
              )}
            </div>
            )}
          </div>

          {shouldShowPaywall ? (
            <section className="space-y-3">
              <CircleLockedCover thumbnail={post.preview?.preview_image ?? null} />
              <h2 className="text-xl font-semibold tracking-tight">Premium post</h2>
              {post.preview?.preview_text && <p className="break-words leading-relaxed">{post.preview.preview_text}</p>}
              <CirclePreviewFade />
              {(hasActiveSubscription || isOwner) ? (
                <div className="space-y-3 rounded-xl border border-border bg-primary/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {isOwner ? 'Restoring author access...' : 'Included in your subscription — unlocking post...'}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => retryAccess()}>
                      Refresh
                    </Button>
                  </div>
                </div>
              ) : (
              <div className="space-y-3 rounded-xl border border-border bg-primary/5 p-4">
                <div className="space-y-1">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Lock aria-hidden="true" className="size-4" />
                    Unlock to keep reading
                  </h3>
                  {circle?.subscription_enabled && (
                    <p className="text-xs text-muted-foreground">
                      Pay once with coins for this post, or subscribe to read all posts in this circle for free.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {post.premium_price != null && post.premium_price > 0 && (
                    <Button
                      className="min-h-11 flex-1 rounded-xl"
                      onClick={handleUnlock}
                      disabled={isUnlocking || (!!user && wallet !== undefined && wallet.balance < post.premium_price)}
                    >
                      {isUnlocking ? <SerkleLoader size="xs" /> : 'Unlock for ' + post.premium_price + ' coins'}
                    </Button>
                  )}
                  {circle?.subscription_enabled && !hasActiveSubscription && (
                    <Button variant="outline" className="min-h-11 flex-1 rounded-xl" onClick={() => setSubscriptionOpen(true)}>
                      {circle.subscription_price ? `Subscribe (${circle.subscription_price} coins/mo)` : 'Subscribe · Unlock all'}
                    </Button>
                  )}
                </div>
                {user && post.premium_price != null && post.premium_price > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Wallet balance {(wallet?.balance ?? 0).toLocaleString()} coins
                    {wallet !== undefined && wallet.balance < post.premium_price && <span className="text-destructive"> · Top up to unlock</span>}
                  </p>
                )}
              </div>
              )}
            </section>
          ) : isRichText ? (
            <div className="prose max-w-none break-words dark:prose-invert" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
          ) : (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p>
          )}

          {/* Comments Section */}
          {!shouldShowPaywall && (
            <CirclePostComments
              postId={postId!}
              commentsCount={post.stats?.comments_count || 0}
              isOpen={commentsOpen}
              recipientId={post.user_id}
              recipientName={post.author?.name}
            />
          )}
        </article>
      </main>
      <LikersModal
        isOpen={showLikersModal}
        onClose={() => setShowLikersModal(false)}
        postId={postId || ''}
      />
      {circle?.subscription_enabled && circleId && (
        <SubscribeCircleModal
          isOpen={subscriptionOpen}
          onClose={() => setSubscriptionOpen(false)}
          circleId={circleId}
          circleName={circle.name}
          subscriptionPrice={circle.subscription_price ?? undefined}
          onSubscribed={async () => {
            await refreshCircleAccessQueries(queryClient, { circleId, postId });
          }}
        />
      )}
    </div>
  );
};

export default CirclePostDetail;
