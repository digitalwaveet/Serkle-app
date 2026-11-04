import { purchaseCircleAccess, CIRCLE_ACCESS_QUERY_KEYS } from '@/lib/circlePayments';
import { signProtectedMedia } from '@/lib/protectedMedia';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Crown, Lock, Coins, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TipButton } from '@/components/circles/TipButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { useUser } from '@/contexts/UserContext';
import { useCircleSubscription } from '@/hooks/useCircleSubscription';
import { Input } from '@/components/ui/input';
import EmojiPicker from '@/components/EmojiPicker';
import PostReactionButton from '@/components/post/PostReactionButton';
import LikersModal from '@/components/LikersModal';
import { PDFCarousel } from '@/components/post/PDFCarousel';

console.log('DEBUG V3: useCircleSubscription hook:', typeof useCircleSubscription);

// Comments component for circle posts
const CirclePostComments: React.FC<{ postId: string; commentsCount: number }> = ({ postId, commentsCount }) => {
  const [newComment, setNewComment] = useState('');
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['circle-post-comments', postId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_post_comments', { _post_id: postId });
      if (error) throw error;
      return data || [];
    },
    enabled: !!postId,
  });

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
    <div className="mt-12 pt-8 border-t border-border">
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
          {comments.map((comment: any) => (
            <div key={comment.comment_id} className="flex gap-3">
              <Avatar className="size-8 flex-shrink-0">
                <AvatarImage src={comment.avatar_url} />
                <AvatarFallback className="text-xs" style={{ backgroundColor: comment.avatar_color }}>
                  {comment.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-foreground">{comment.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


const CirclePostDetail: React.FC = () => {
  const { circleId, postId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const { user } = useUser();
  const { wallet } = useCoinWallet(user?.id);
  const [showLikersModal, setShowLikersModal] = useState(false);

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
    queryKey: ['circle-post', postId, user?.id],
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
      if (!rows || rows.length === 0) throw new Error('Post not found');
      const row: any = await signProtectedMedia(rows[0]);

      // Tip count (separate aggregate query).
      const { count: tipCount } = await supabase
        .from('circle_tips')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

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

  console.log('DEBUG V3: Calling useCircleSubscription', typeof useCircleSubscription);
  const { data: subscription, isLoading: isSubscriptionLoading } = useCircleSubscription(circleId);
  const isOwner = user?.id === circle?.creator_id || user?.id === post?.user_id;
  const isPaidPremium = post?.is_premium && post?.premium_price && post.premium_price > 0;
  const isSubscriber = subscription?.status === 'active';
  
  // While subscription is still resolving for a premium post, treat it as paywalled to prevent flash
  const subscriptionResolved = !isSubscriptionLoading;
  const shouldShowPaywall = post?.is_premium && !post?.user_has_unlocked;

  if (isLoading || (isPaidPremium && isSubscriptionLoading)) {
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
    if (isUnlocking) return;
    if (!post.premium_price || post.premium_price <= 0) { navigate(`/circle/${circleId}`); return; }
    if (!user) {
      toast({ title: "Please log in to unlock", variant: "destructive" });
      return;
    }
    setIsUnlocking(true);
    try {
      const result = await purchaseCircleAccess('post', postId!, { expectedPrice: post.premium_price });
      toast({ title: 'Post available', description: result.charged ? `${result.charged} coins paid.` : 'Included in your existing access.' });
      CIRCLE_ACCESS_QUERY_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
    } catch (error: any) {
      toast({ title: "Unlock failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLike = async (reactionType: string = 'like') => {
    try {
      if (!user) {
        toast({ title: "Please log in to like posts", variant: "destructive" });
        return;
      }

      const isRemoving = post.user_has_liked && (reactionType === 'like' || !reactionType);
      
      if (isRemoving) {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        // Use upsert to prevent 409 Conflict and ensure post owner persistence
        // @ts-ignore
        await supabase.from('likes').upsert({
          post_id: postId,
          user_id: user.id,
          reaction_type: reactionType
        }, { onConflict: 'post_id,user_id' });
      }

      queryClient.invalidateQueries({ queryKey: ['circle-post', postId] });
      // Also invalidate the circle feed to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['circle-posts', circleId] });
    } catch (error: any) {
      toast({ title: "Failed to like post", description: error.message, variant: "destructive" });
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
      toast({ title: "Tip sent successfully!", description: `You tipped $${amount}` });
    } catch (error: any) {
      toast({ title: "Failed to send tip", description: error.message, variant: "destructive" });
    }
  };

  const isRichText = (content: string) => {
    return /<[a-z][\s\S]*>/i.test(content) || content.includes('<p>') || content.includes('<strong>');
  };

  // First paragraph (used as the free, readable teaser on paywalled posts).
  const getFirstParagraph = (content: string): string => {
    if (!content) return '';
    if (isRichText(content)) {
      const paras = content.match(/<p>[\s\S]*?<\/p>/gi);
      return paras && paras.length ? paras[0] : content;
    }
    const parts = content.split(/\n\s*\n/);
    return (parts[0] || content).trim();
  };

  const getDisplayContent = () => {
    // When paywalled, reveal only the first paragraph as a teaser.
    if (shouldShowPaywall) return getFirstParagraph(post?.content || '');
    return post?.content || '';
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate(`/circle/${circleId}`)}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <h1 className="font-semibold text-lg">{circle?.name || 'Post'}</h1>
            {post?.is_premium && (
              <span className={cn(
                "text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 rounded-full flex items-center gap-1",
                post.user_has_unlocked ? "bg-green-500 text-white" : "bg-gradient-secondary text-primary-foreground"
              )}>
                {post.user_has_unlocked ? <Check className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                Premium
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <article className="max-w-3xl mx-auto">
          {/* PDF Carousel */}
          {post?.post_type === 'pdf' && post.media_urls && post.media_urls.length > 0 && (
            <div className="mb-6 relative">
              <PDFCarousel pages={post.media_urls} className="aspect-[4/5] shadow-lg" />
            </div>
          )}

          {/* Hero Image */}
          {post?.cover_image_url && post?.post_type !== 'pdf' && (
            <div className="mb-6 relative">
              <img
                src={post.cover_image_url}
                alt="Post cover"
                className="w-full h-64 md:h-80 object-cover rounded-2xl"
              />
              {post?.is_premium && !shouldShowPaywall && (
                <div className="absolute top-4 right-4 bg-gradient-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold shadow-glow">
                  Premium
                </div>
              )}
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
                onClick={() => setIsBookmarked(!isBookmarked)}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isBookmarked ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <Bookmark className="size-5" />
              </button>
            </div>

            {/* Interaction buttons */}
            <div className="flex items-center gap-6 py-4 border-y border-border">
              <PostReactionButton
                isLiked={post.user_has_liked}
                likesCount={post.stats?.likes_count || 0}
                userReaction={post.user_reaction}
                onLike={handleLike}
                onShowLikers={() => setShowLikersModal(true)}
              />
              
              <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <MessageCircle className="size-5" />
                <span className="text-sm">{post.stats?.comments_count || 0}</span>
              </button>
              
              <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Share2 className="size-5" />
                <span className="text-sm">{post.stats?.shares_count || 0}</span>
              </button>

              {post.has_tips_enabled && (
                <TipButton
                  postId={postId!}
                  authorName={post.author.name}
                  tipCount={post.tip_count || 0}
                  userHasTipped={false}
                  onTip={handleTip}
                />
              )}
            </div>
          </div>

          {/* Post Content */}
          <div className="mb-8 relative">
            {/* Visible content — when paywalled, only the first few lines stay
                readable and they fade out into the locked/blurred section below. */}
            {shouldShowPaywall ? (
              <div className="relative">
                {/* Modern fade preview — crisp at the top, dissolving into a short blurred snippet */}
                <div className="relative max-h-60 overflow-hidden">
                  {/* Blurred copy behind (text shows through, unreadable) */}
                  <div
                    aria-hidden
                    className={cn(
                      "blur-[5px] opacity-40 grayscale select-none pointer-events-none text-foreground leading-relaxed text-base",
                      !isRichText(post.content) && "whitespace-pre-line"
                    )}
                  >
                    {isRichText(post.content) ? (
                      <div className="prose prose-base dark:prose-invert max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: post.content }} />
                    ) : (
                      post.content
                    )}
                  </div>
                  {/* Crisp copy on top, masked so only the first lines stay sharp before melting into the blur */}
                  <div
                    className={cn(
                      "absolute inset-0 text-foreground leading-relaxed text-base",
                      !isRichText(post.content) && "whitespace-pre-line"
                    )}
                    style={{
                      WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 22%, transparent 62%)',
                      maskImage: 'linear-gradient(to bottom, #000 0%, #000 22%, transparent 62%)',
                    }}
                  >
                    {isRichText(post.content) ? (
                      <div className="prose prose-base dark:prose-invert max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: post.content }} />
                    ) : (
                      post.content
                    )}
                  </div>
                  {/* Fade the bottom into the page background */}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
                </div>

                {/* Simple lock card */}
                <div className="relative z-10 -mt-10 mx-auto max-w-sm rounded-2xl border border-border/60 bg-background/70 backdrop-blur-xl shadow-lg p-5 flex flex-col items-center text-center gap-3">
                  <div className="flex items-center justify-center size-11 rounded-full bg-primary/10 text-primary">
                    <Lock className="size-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Premium post</p>
                  <Button
                    onClick={handleUnlock}
                    disabled={isUnlocking || (wallet?.balance ?? 0) < (post.premium_price || 0)}
                    className="w-full h-11 bg-gradient-primary hover:opacity-90 text-primary-foreground border-0 shadow-glow"
                  >
                    {isUnlocking ? (
                      <span className="flex items-center gap-2">
                        <SerkleLoader size="xs" className="text-primary-foreground" />
                        Unlocking…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Coins className="size-4" />
                        Unlock for {post.premium_price || 0} 🪙
                      </span>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Balance {wallet?.balance ?? 0} 🪙
                    {(wallet?.balance ?? 0) < (post.premium_price || 0) && (
                      <span className="text-destructive"> · Top up</span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className={cn(
                "text-foreground leading-relaxed text-base",
                !isRichText(getDisplayContent()) && "whitespace-pre-line"
              )}>
                {isRichText(getDisplayContent()) ? (
                  <div
                    className="prose prose-base dark:prose-invert max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: getDisplayContent() }}
                  />
                ) : (
                  getDisplayContent()
                )}
              </div>
            )}
            
            {/* Show full content if unlocked */}
            {!shouldShowPaywall && post?.content !== getDisplayContent() && (
              <div className={cn(
                "text-foreground leading-relaxed text-base mt-8",
                !isRichText(post?.content || '') && "whitespace-pre-line"
              )}>
                {(() => {
                  const fullContent = post?.content || '';
                  if (isRichText(fullContent)) {
                    const paragraphs = fullContent.match(/<p>[\s\S]*?<\/p>/gi) || [];
                    if (paragraphs.length > 1) {
                      return <div 
                        className="prose prose-base dark:prose-invert max-w-none text-foreground"
                        dangerouslySetInnerHTML={{ __html: paragraphs.slice(1).join('') }} 
                      />;
                    }
                    return null;
                  }
                  const paragraphs = fullContent.split('\n\n');
                  if (paragraphs.length > 1) {
                    return paragraphs.slice(1).join('\n\n');
                  }
                  return '';
                })()}
              </div>
            )}
          </div>

          {/* Comments Section */}
          {!shouldShowPaywall && (
            <CirclePostComments postId={postId!} commentsCount={post.stats?.comments_count || 0} />
          )}
        </article>
      </main>
    </div>
  );
};

export default CirclePostDetail;
