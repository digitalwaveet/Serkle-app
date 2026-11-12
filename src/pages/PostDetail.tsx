import { purchaseCircleAccess } from '@/lib/circlePayments';
import { signProtectedMedia } from '@/lib/protectedMedia';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { OriginalImageDownload } from '@/components/ui/OriginalImageDownload';
import React, { useState, useEffect, useRef } from 'react';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Share2, MoreHorizontal, BadgeCheck, Send, Loader2, MapPin, Mic, Pencil, Trash2, Bookmark, Flag, BookmarkCheck, Image, Lock, Crown, Coins } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ReportDialog } from '@/components/ReportDialog';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { PersistentCommentComposer } from '@/components/PersistentCommentComposer';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useUser } from '@/contexts/UserContext';
import { usePostMutations } from '@/hooks/usePostMutations';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { GiftEmoji } from '@/components/GiftEmojiPicker';
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from '@/components/ui/carousel';
import CommentActionMenu from '@/components/CommentActionMenu';
import { toast } from 'sonner';
import { useCircleSubscription } from '@/hooks/useCircleSubscription';
import { PremiumUnlockBanner } from '@/components/premium/PremiumUnlockBanner';
import { PremiumContentSkeleton } from '@/components/premium/PremiumContentSkeleton';
import { useNavigation } from '@/contexts/NavigationContext';
import PostReactionButton from '@/components/post/PostReactionButton';
import ShareIcon from '@/components/post/ShareIcon';
import MiniGiftAnimation from '@/components/post/MiniGiftAnimation';
import GiftCommentCard from '@/components/post/GiftCommentCard';
import {
  PendingGiftCommentRecord,
  parseGiftComment,
  savePendingGiftComment,
  getPendingGiftCommentsForPost,
  finalizePendingGiftComment,
  flushPendingGiftCommentKeepalive,
  getGiftAnimationTier,
} from '@/lib/giftComment';
import { useQueryClient } from '@tanstack/react-query';
import LikersModal from '@/components/LikersModal';
import { PDFCarousel } from '@/components/post/PDFCarousel';

console.log('DEBUG V3: useCircleSubscription hook (PostDetail):', typeof useCircleSubscription);

interface Comment {
  id: string;
  userId?: string;
  username?: string;
  user: {
    name: string;
    initials: string;
    avatarColor: string;
    avatar?: string;
    verified?: boolean;
  };
  text: string;
  timestamp: string;
  likes: number;
  replies: number;
  isLiked: boolean;
  parentId?: string;
}

const formatCount = (n: number) => {
  if (n < 1000) return String(n);
  if (n < 1000000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "m";
};

const formatRelativeTime = (iso: string) => {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
};

const PostDetail: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { triggerHaptic } = useHapticFeedback();
  const { user } = useUser();
  const { toggleLike, addComment } = usePostMutations();
  const { transferCoins, wallet, invalidate: invalidateWallet } = useCoinWallet(user?.id);
  const { pushModalState } = useNavigation();
  const queryClient = useQueryClient();

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveAnim, setSaveAnim] = useState<'idle' | 'save' | 'unsave'>('idle');
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [detailCarouselApi, setDetailCarouselApi] = useState<CarouselApi>();
  const [detailCurrentSlide, setDetailCurrentSlide] = useState(0);
  const [commentAction, setCommentAction] = useState<{ commentId: string; position: { x: number; y: number } } | null>(null);
  const [accessRevision, setAccessRevision] = useState(0);
  const [hasUnlocked, setHasUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [circleCreatorId, setCircleCreatorId] = useState<string | null>(null);
  const [userReaction, setUserReaction] = useState<string | undefined>(undefined);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [activeGiftAnimation, setActiveGiftAnimation] = useState<PendingGiftCommentRecord | null>(null);
  const [isGiftSending, setIsGiftSending] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likeInFlightRef = useRef<boolean>(false);
  const saveInFlightRef = useRef<boolean>(false);
  const shareInFlightRef = useRef<boolean>(false);
  const giftInFlightRef = useRef<boolean>(false);
  const activeGiftRecordRef = useRef<PendingGiftCommentRecord | null>(null);
  const giftFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const commentsSectionRef = useRef<HTMLElement | null>(null);

  const { data: subscription } = useCircleSubscription(post?.circle_id);

  useEffect(() => {
    const handlePageHide = () => {
      if (activeGiftRecordRef.current) {
        flushPendingGiftCommentKeepalive(activeGiftRecordRef.current);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && activeGiftRecordRef.current) {
        flushPendingGiftCommentKeepalive(activeGiftRecordRef.current);
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (giftFallbackTimerRef.current) clearTimeout(giftFallbackTimerRef.current);
      if (activeGiftRecordRef.current) {
        flushPendingGiftCommentKeepalive(activeGiftRecordRef.current);
      }
    };
  }, []);

  // Track detail carousel slide changes
  useEffect(() => {
    if (!detailCarouselApi) return;
    const onSelect = () => setDetailCurrentSlide(detailCarouselApi.selectedScrollSnap());
    detailCarouselApi.on('select', onSelect);
    return () => { detailCarouselApi.off('select', onSelect); };
  }, [detailCarouselApi]);

  // Fetch post and comments from database
  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;

      setLoading(true);
      // Use the new definitive RPC for fetching post details
      const { data, error } = await supabase.rpc('get_post_details', {
        _post_id: postId
      });

      if (error) {
        console.error('Error fetching post:', error);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const postData = await signProtectedMedia(data[0]);
        setPost(postData);
        setLikesCount(postData.likes_count || 0);
        setLiked(postData.user_has_liked || false);
        setUserReaction(postData.user_reaction);
        setHasUnlocked(postData.user_has_unlocked || false);
        setSaved(postData.user_has_saved || false);

        // Fetch circle creator if it's a circle post
        if (postData.circle_id) {
          const { data: circleData } = await supabase
            .from('circles')
            .select('creator_id')
            .eq('id', postData.circle_id)
            .maybeSingle();
          if (circleData) {
            setCircleCreatorId(circleData.creator_id);
          }
        }

        // Fetch comments for this post
        const { data: commentsData, error: commentsError } = await supabase
          .rpc('get_post_comments', { _post_id: postId });

        if (commentsError) {
          console.error('Error fetching comments:', commentsError);
        } else if (commentsData) {
          const formattedComments: Comment[] = commentsData.map((c: any) => ({
            id: c.comment_id,
            userId: c.user_id,
            username: c.username,
            user: {
              name: c.name,
              initials: c.initials,
              avatarColor: c.avatar_color,
              avatar: c.avatar_url,
              verified: false,
            },
            text: c.content,
            timestamp: formatRelativeTime(c.created_at),
            likes: c.likes_count || 0,
            replies: 0,
            isLiked: c.user_has_liked || false,
            parentId: c.parent_id || undefined,
          }));
          setComments(formattedComments);
        }

        // Recover any previously paid gift comment that was interrupted before publication
        if (user?.id) {
          const pendingGifts = getPendingGiftCommentsForPost(postId, user.id);
          for (const pending of pendingGifts) {
            const finalized = await finalizePendingGiftComment(pending);
            if (finalized) {
              setComments((prev) => {
                if (prev.some((c) => c.id === finalized.id || c.text.includes(pending.requestId))) {
                  return prev;
                }
                return [
                  {
                    id: finalized.id,
                    userId: user.id,
                    username: user.username,
                    user: {
                      name: user.name,
                      initials: user.initials,
                      avatarColor: user.avatarColor,
                      avatar: user.avatar,
                      verified: user.isVerified,
                    },
                    text: finalized.content,
                    timestamp: 'Just now',
                    likes: 0,
                    replies: 0,
                    isLiked: false,
                  },
                  ...prev,
                ];
              });
            }
          }
        }
      }
      setLoading(false);
    };

    fetchPost();
  }, [postId, user, !!subscription, accessRevision]);

  // Real-time subscription for new comments (including gift comments from other users)
  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`post-comments:${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          const newRow = payload.new as any;
          if (!newRow?.id) return;

          // Fetch author profile for real-time comment display
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, name, initials, avatar_url, avatar_color, is_verified')
            .eq('id', newRow.user_id)
            .maybeSingle();

          setComments((prev) => {
            if (prev.some((c) => c.id === newRow.id)) return prev;
            const parsedGift = parseGiftComment(newRow.content || '');
            if (
              parsedGift?.transactionId &&
              prev.some((c) => c.text.includes(parsedGift.transactionId))
            ) {
              return prev;
            }
            const incoming: Comment = {
              id: newRow.id,
              userId: newRow.user_id,
              username: profile?.username || undefined,
              user: {
                name: profile?.name || 'User',
                initials: profile?.initials || 'U',
                avatarColor: profile?.avatar_color || '#7864EA',
                avatar: profile?.avatar_url || undefined,
                verified: profile?.is_verified || false,
              },
              text: newRow.content,
              timestamp: parsedGift ? 'Just now' : formatRelativeTime(newRow.created_at || new Date().toISOString()),
              likes: 0,
              replies: 0,
              isLiked: false,
              parentId: newRow.parent_id || undefined,
            };
            return [incoming, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <SerkleLoader label="Loading post" showText />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Post not found</h2>
          <Button onClick={() => navigate('/')} variant="outline">
            Go back to feed
          </Button>
        </div>
      </div>
    );
  }

  const handleCommentSubmit = async (commentText: string, parentId?: string) => {
    if (!user) return;

    try {
      const newComment = await addComment(postId!, user.id, commentText, parentId);

      if (newComment) {
        const comment: Comment = {
          id: newComment.id,
          user: {
            name: user.name,
            initials: user.initials,
            avatarColor: user.avatarColor,
            avatar: user.avatar,
            verified: user.isVerified,
          },
          text: commentText,
          timestamp: 'now',
          likes: 0,
          replies: 0,
          isLiked: false,
          parentId: parentId,
        };
        setComments(prev => [comment, ...prev]);
        if (parentId) {
          setReplyingTo(null);
          setReplyText('');
        }
        triggerHaptic('light');
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment || !user) return;

    // Optimistic update
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 }
        : c
    ));
    triggerHaptic('light');

    try {
      if (comment.isLiked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: user.id });
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
      // Revert on error
      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 }
          : c
      ));
    }
  };

  const handleCommentTap = (commentId: string, e: React.MouseEvent) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment || comment.userId !== user?.id) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pushModalState('comment-action', () => setCommentAction(null));
    setCommentAction({
      commentId,
      position: { x: rect.left + rect.width / 2, y: rect.top },
    });
  };

  const handleEditComment = async (commentId: string, newText: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, text: newText } : c));
    try {
      const { error } = await supabase.from('comments').update({ content: newText }).eq('id', commentId);
      if (error) throw error;
      toast.success('Comment edited');
    } catch {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, text: comment.text } : c));
      toast.error('Failed to edit comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    setComments(prev => prev.filter(c => c.id !== commentId && c.parentId !== commentId));
    try {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw error;
      toast.success('Comment deleted');
    } catch {
      setComments(prev => [...prev, comment]);
      toast.error('Failed to delete comment');
    }
  };

  const isSubscriber = subscription?.status === 'active';
  const isCircleOwner = user?.id === circleCreatorId;
  const isOwnPost = user?.id === post?.user_id;
  const isPaidPremium = post?.is_premium && post?.premium_price && post.premium_price > 0;
  const shouldShowPaywall = post?.is_premium && !hasUnlocked && !isOwnPost && !isCircleOwner;
  // Friends-only gate: the RPC already withholds the post from non-audience
  // viewers, but we also disable the message/interaction affordances as a backstop.
  const canInteract = post?.viewer_can_interact !== false;

  const handleUnlock = async () => {
    if (!user) {
      toast.error("Please log in to unlock");
      return;
    }
    setIsUnlocking(true);
    try {
      const result = await purchaseCircleAccess('post', postId!, { expectedPrice: post.premium_price });
      toast.success(result.charged ? `Post unlocked for ${result.charged} coins.` : 'Included in your existing access.');
      setAccessRevision(value => value + 1);
    } catch (error: any) {
      toast.error(error.message || "Unlock failed");
    } finally {
      setIsUnlocking(false);
    }
  };

  const isRichText = (content: string) => {
    return /<[a-z][\s\S]*>/i.test(content) || content.includes('<p>') || content.includes('<strong>') || content.includes('<ul>');
  };

  const getDisplayContent = () => {
    const content = post?.content || '';
    if (!shouldShowPaywall) return content;

    if (isRichText(content)) {
      const paragraphs = content.match(/<p>[\s\S]*?<\/p>/gi) || [];
      if (paragraphs.length <= 1) return content;
      return paragraphs.slice(0, 1).join('');
    }

    const paragraphs = content.split('\n\n');
    if (paragraphs.length <= 1) return content;
    return paragraphs.slice(0, 1).join('\n\n');
  };

  const handleDeletePost = async () => {
    if (!postId) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      toast.success('Post deleted');
      navigate('/');
    } catch {
      toast.error('Failed to delete post');
    }
  };

  const handleEditPost = async () => {
    if (!postId || !editContent.trim()) return;
    try {
      const { error } = await supabase.from('posts').update({ content: editContent }).eq('id', postId);
      if (error) throw error;
      setPost((prev: any) => ({ ...prev, content: editContent }));
      setIsEditing(false);
      toast.success('Post updated');
    } catch {
      toast.error('Failed to update post');
    }
  };

  const triggerSaveAnim = (nextSaved: boolean) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveAnim(nextSaved ? 'save' : 'unsave');
    saveTimerRef.current = setTimeout(() => setSaveAnim('idle'), nextSaved ? 260 : 180);
  };

  const handleSavePost = async () => {
    if (!user || !postId || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    const nextSaved = !saved;
    setSaved(nextSaved);
    triggerSaveAnim(nextSaved);
    try {
      if (!nextSaved) {
        const { error } = await supabase.from('saves').delete().eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
        toast.success('Post unsaved');
      } else {
        const { error } = await supabase.from('saves').insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
        toast.success('Post saved');
      }
      triggerHaptic('light');
    } catch {
      setSaved(!nextSaved);
      toast.error('Failed to update save');
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const handleSharePost = async () => {
    if (shareInFlightRef.current) return;
    shareInFlightRef.current = true;
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: post.name, text: post.content, url: window.location.href });
        } catch { }
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied');
      }
    } finally {
      shareInFlightRef.current = false;
    }
  };

  const handleReportPost = async (reason: string, details: string) => {
    if (!user || !postId) return;
    await supabase.from('abuse_reports').insert({
      reporter_user_id: user.id,
      reported_user_id: post.user_id,
      report_type: 'post',
      reason: reason,
      description: `Reported post ID: ${postId}. Details: ${details}`,
    });
    toast.success('Post reported');
  };

  const handleLikePost = async (reactionType: string = 'like') => {
    if (!user || likeInFlightRef.current) return;
    likeInFlightRef.current = true;
    const isRemoving = liked && (reactionType === 'like' || !reactionType);
    const wasLiked = liked;
    const prevCount = likesCount;
    const prevReaction = userReaction;
    const willBeLiked = !isRemoving;

    setLiked(willBeLiked);
    if (!wasLiked && willBeLiked) setLikesCount(prev => prev + 1);
    else if (wasLiked && !willBeLiked) setLikesCount(prev => Math.max(0, prev - 1));

    setUserReaction(willBeLiked ? reactionType : undefined);

    triggerHaptic('light');
    try {
      const ok = await toggleLike(postId!, user.id, wasLiked, reactionType);
      if (ok === false) {
        setLiked(wasLiked);
        setLikesCount(prevCount);
        setUserReaction(prevReaction);
      }
    } finally {
      likeInFlightRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="p-2 h-auto"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="font-semibold text-foreground">{post.name}</h1>
          <p className="text-sm text-muted-foreground">Post</p>
        </div>
      </header>

      {/* Post Content */}
      <main className="flex-1 flex flex-col">
        <article className="bg-card border-b border-border">
          {/* Post Header */}
          <div className="p-4 flex items-center gap-3">
            <div
              className="size-10 rounded-full grid place-items-center text-sm font-medium text-white overflow-hidden"
              style={{ backgroundColor: post.avatar_color }}
            >
              {post.avatar_url ? (
                <img src={post.avatar_url} alt={post.initials} className="w-full h-full object-cover" />
              ) : (
                post.initials
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-foreground">
                  {post.name}
                </h3>
                {post.is_verified && (
                  <BadgeCheck className="size-4 text-secondary" />
                )}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                {formatRelativeTime(post.created_at)}
                {post.location_text && (
                  <span className="flex items-center gap-0.5 text-primary">
                    <MapPin className="size-3" />
                    <span className="max-w-[160px] truncate">{post.location_text}</span>
                  </span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isOwnPost && (
                  <>
                    <DropdownMenuItem onClick={() => { setEditContent(post.content); setIsEditing(true); }}>
                      <Pencil className="size-4 mr-2" /> Edit Post
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDeletePost} className="text-destructive focus:text-destructive">
                      <Trash2 className="size-4 mr-2" /> Delete Post
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleSharePost}>
                  <ShareIcon className="size-4 mr-2" /> Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSavePost}>
                  {saved ? <BookmarkCheck className="size-4 mr-2" /> : <Bookmark className="size-4 mr-2" />}
                  {saved ? 'Unsave' : 'Save Post'}
                </DropdownMenuItem>
                {!isOwnPost && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)} className="text-destructive focus:text-destructive">
                      <Flag className="size-4 mr-2" /> Report
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Post Content */}
          <div className="px-4 pb-3">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[80px] p-2 rounded-lg border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                  dir="auto"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleEditPost} disabled={!editContent.trim()}>Save</Button>
                </div>
              </div>
            ) : (
              <div className={cn(
                "text-[14px] text-foreground leading-relaxed break-words relative",
                !isRichText(getDisplayContent()) && "whitespace-pre-wrap"
              )}>
                {isRichText(getDisplayContent()) ? (
                  <div
                    className="prose prose-base dark:prose-invert max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: getDisplayContent() }}
                  />
                ) : (
                  <p dir="auto">
                    {getDisplayContent().split(' ').map((word: string, i: number) =>
                      word.startsWith('#') ? <span key={i} className="text-primary font-medium">{word} </span> : word + ' '
                    )}
                  </p>
                )}
                {shouldShowPaywall && (
                  <div className="relative mt-8 sticky-paywall-container">
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-muted/5">
                      {/* Blurred scrolling actual content */}
                      <div className="pt-8 px-8 pb-[100vh] blur-[32px] opacity-20 select-none pointer-events-none grayscale">
                        {isRichText(post.content) ? (
                          <div
                            className="prose prose-base dark:prose-invert max-w-none text-foreground"
                            dangerouslySetInnerHTML={{ __html: post.content }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap text-foreground">{post.content}</p>
                        )}
                        <PremiumContentSkeleton />
                      </div>

                      {/* Fixed-Center Sticky Lock Modal */}
                      <div className="absolute inset-x-0 inset-y-0 z-40 pointer-events-none group/paywall">
                        <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-6 pointer-events-auto transition-all duration-700 ease-out translate-y-0">
                          {/* Subdued vignette background that appears when modal is sticky */}
                          <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px] opacity-0 group-hover/paywall:opacity-100 transition-opacity duration-1000" />

                          <div className="relative w-full max-w-md bg-background/80 backdrop-blur-3xl rounded-[2.5rem] border border-white/20 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] p-1 overflow-hidden group animate-in zoom-in-95 fade-in duration-700">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/10 animate-pulse" />
                            <div className="relative p-6 text-left">
                              <PremiumUnlockBanner
                                price={post.premium_price || 0}
                                balance={wallet?.balance ?? 0}
                                onUnlock={handleUnlock}
                                isUnlocking={isUnlocking}
                                className="my-0 border-0 shadow-none bg-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 h-[60vh] bg-gradient-to-t from-background via-background to-transparent pointer-events-none z-10" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {post.tags && !isEditing && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-full text-xs font-medium bg-gradient-subtle text-primary border border-primary/20"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Post Media - Multi-image/video carousel or single media */}
          {post.post_type === 'pdf' && post.media_urls && post.media_urls.length > 0 ? (
            <div className="px-0 relative mb-4">
              <PDFCarousel pages={post.media_urls} className="aspect-[4/5] shadow-lg" />
            </div>
          ) : post.media_urls && post.media_urls.length > 0 ? (
            <div className="px-0 relative">
              <Carousel className="w-full" setApi={setDetailCarouselApi}>
                <CarouselContent>
                  {post.media_urls.map((url: string, index: number) => (
                    <CarouselItem key={index}>
                      <div className="relative overflow-hidden">
                        {/\.(mp4|webm|mov|ogg|m3u8)(\?|$)/i.test(url) ? (
                          <video
                            src={url}
                            className={cn(
                              "w-full object-contain max-h-[70vh] bg-black transition-all duration-500",
                              shouldShowPaywall && "blur-xl"
                            )}
                            controls={!shouldShowPaywall}
                            preload="metadata"
                            playsInline
                          />
                        ) : (
                          <OptimizedImage
                            src={url}
                            alt={`${post.media_alt || 'Post image'} ${index + 1}`}
                            size="full"
                            className={cn(
                              "w-full object-contain max-h-[70vh] bg-black/5 transition-all duration-500",
                              shouldShowPaywall && "blur-xl"
                            )}
                          />
                        )}
                        {!shouldShowPaywall && !/\.(mp4|webm|mov|ogg|m3u8)(\?|$)/i.test(url) && <OriginalImageDownload src={url} />}

                        {shouldShowPaywall && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px] z-10" />
                        )}
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              {post.media_urls.length > 1 && (
                <>
                  <div className="absolute top-3 right-3 bg-black/70 text-white text-xs font-medium px-2.5 py-1 rounded-full z-10">
                    {detailCurrentSlide + 1}/{post.media_urls.length}
                  </div>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    {post.media_urls.map((_: string, idx: number) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === detailCurrentSlide
                          ? 'bg-primary w-4'
                          : 'bg-card/60 w-1.5'
                          }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : post.cover_image_url || post.media_url ? (
            <div className="px-0">
              <div className="relative overflow-hidden">
                {/\.(mp4|webm|mov|ogg|m3u8)(\?|$)/i.test(post.cover_image_url || post.media_url || '') ? (
                  <video
                    src={post.cover_image_url || post.media_url}
                    className="w-full object-contain max-h-[70vh] bg-black"
                    controls
                    preload="metadata"
                    playsInline
                  />
                ) : (
                  <OptimizedImage
                    src={post.cover_image_url || post.media_url}
                    alt={post.media_alt || ""}
                    size="full"
                    className="w-full object-contain max-h-[70vh] bg-black/5"
                  />
                )}
                {!shouldShowPaywall && !/\.(mp4|webm|mov|ogg|m3u8)(\?|$)/i.test(post.cover_image_url || post.media_url || '') && <OriginalImageDownload src={post.cover_image_url || post.media_url} />}
              </div>
            </div>
          ) : null}

          {/* Voice Note */}
          {post.voice_url && (
            <div className="px-3 py-2 flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const audio = voiceAudioRef.current;
                  if (!audio) return;
                  if (audio.paused) {
                    if (audio.ended) audio.currentTime = 0;
                    try {
                      await audio.play();
                    } catch {
                      setVoicePlaying(false);
                    }
                  } else {
                    audio.pause();
                  }
                }}
                aria-label={voicePlaying ? 'Pause voice note' : 'Play voice note'}
                aria-pressed={voicePlaying}
                className={cn(
                  "engagement-btn engagement-btn--icon-only shrink-0",
                  voicePlaying && "engagement-btn--mic-active"
                )}
              >
                <Mic strokeWidth={1.85} className="engagement-icon" />
              </button>
              <audio
                ref={voiceAudioRef}
                controls
                src={post.voice_url}
                className="h-8 flex-1"
                preload="metadata"
                onPlay={() => setVoicePlaying(true)}
                onPause={() => setVoicePlaying(false)}
                onEnded={() => setVoicePlaying(false)}
              />
            </div>
          )}

          {/* Post Actions */}
          <div className="px-3 py-2 flex items-center gap-2 border-t border-border/40">
            <PostReactionButton
              isLiked={liked}
              likesCount={likesCount}
              userReaction={userReaction}
              onLike={handleLikePost}
              onShowLikers={() => setShowLikersModal(true)}
            />

            <button
              type="button"
              onClick={() => {
                setCommentsOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    requestAnimationFrame(() => {
                      commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
              <span className="engagement-count">{formatCount(comments.length)}</span>
            </button>

            <button
              type="button"
              onClick={handleSharePost}
              aria-label="Share"
              className="engagement-btn"
            >
              <ShareIcon strokeWidth={1.85} className="engagement-icon" />
              <span className="engagement-count">{formatCount(post.post_stats?.shares_count || 0)}</span>
            </button>

            <div className="ml-auto flex items-center">
              <button
                type="button"
                onClick={handleSavePost}
                aria-label={saved ? 'Unsave post' : 'Save post'}
                aria-pressed={saved}
                className={cn(
                  "engagement-btn engagement-btn--icon-only",
                  saved && "engagement-btn--saved"
                )}
              >
                <Bookmark
                  strokeWidth={1.85}
                  className={cn(
                    "engagement-icon",
                    saved ? "engagement-bookmark--saved" : "engagement-bookmark--unsaved",
                    saveAnim === 'save' && "engagement-bookmark--anim-save",
                    saveAnim === 'unsave' && "engagement-bookmark--anim-unsave"
                  )}
                />
              </button>
            </div>
          </div>
        </article>

        {/* Comments Section */}
        <section
          ref={commentsSectionRef}
          className={cn(
            "flex-1 bg-background engagement-comment-panel",
            !commentsOpen && "hidden"
          )}
        >
          <div className="px-4 py-3 border-b border-border/40">
            <h2 className="font-semibold text-foreground">
              {formatCount(comments.filter(c => !c.parentId).length)} Comments
            </h2>
          </div>

          {/* Comments List */}
          <div className="flex-1 pb-20">
            {comments.filter(c => !c.parentId).map((comment) => (
              <div key={comment.id}>
                <div className="px-4 py-3 border-b border-border/40 cursor-pointer" onClick={(e) => handleCommentTap(comment.id, e)}>
                  <div className="flex gap-3">
                    <div
                      className="size-8 rounded-full grid place-items-center text-xs font-medium text-white shrink-0 overflow-hidden cursor-pointer"
                      style={{ backgroundColor: comment.user.avatarColor }}
                      onClick={() => comment.userId && navigate(`/profile/${comment.username || comment.userId}`)}
                    >
                      {comment.user.avatar ? (
                        <img src={comment.user.avatar} alt={comment.user.initials} className="w-full h-full object-cover" />
                      ) : (
                        comment.user.initials
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className="font-medium text-sm text-foreground cursor-pointer hover:underline"
                          onClick={() => comment.userId && navigate(`/profile/${comment.username || comment.userId}`)}
                        >
                          {comment.user.name}
                        </span>
                        {comment.user.verified && (
                          <BadgeCheck className="size-3 text-secondary" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {comment.timestamp}
                        </span>
                      </div>

                      {(() => {
                        const giftMeta = parseGiftComment(comment.text);
                        if (giftMeta) {
                          return <GiftCommentCard metadata={giftMeta} className="mb-2" />;
                        }
                        return (
                          <p className="text-sm text-foreground mb-2">
                            {comment.text}
                          </p>
                        );
                      })()}

                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLikeComment(comment.id);
                          }}
                          className="flex items-center gap-1 text-xs font-medium hover:text-[#F43774] active:scale-[0.93] transition-all duration-150"
                        >
                          <Heart
                            strokeWidth={1.85}
                            className={`size-3.5 transition-colors duration-200 ${comment.isLiked ? 'fill-[#F43774] text-[#F43774]' : 'text-[#71829A]'}`}
                          />
                          {comment.likes > 0 && <span className={comment.isLiked ? 'text-[#F43774]' : 'text-[#71829A]'}>{comment.likes}</span>}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplyingTo(replyingTo === comment.id ? null : comment.id);
                          }}
                          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Reply
                          {comments.filter(r => r.parentId === comment.id).length > 0 && (
                            <span className="ml-1">({comments.filter(r => r.parentId === comment.id).length})</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reply input */}
                {replyingTo === comment.id && (
                  <div className="px-4 py-2 ml-11 border-b border-border/30 engagement-comment-panel">
                    <div className="flex items-end gap-2">
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Reply to ${comment.user.name}...`}
                        className="flex-1 text-sm bg-muted/50 rounded-full px-3 py-2 outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && replyText.trim()) {
                            handleCommentSubmit(replyText.trim(), comment.id);
                          }
                          if (e.key === 'Escape') {
                            setReplyingTo(null);
                            setReplyText('');
                          }
                        }}
                        autoFocus
                      />
                      {replyText.trim() && (
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => handleCommentSubmit(replyText.trim(), comment.id)}
                        >
                          <Send className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Replies */}
                {comments.filter(r => r.parentId === comment.id).map((reply) => (
                  <div key={reply.id} className="px-4 py-2 ml-11 border-b border-border/30 cursor-pointer" onClick={(e) => handleCommentTap(reply.id, e)}>
                    <div className="flex gap-2">
                      <div
                        className="size-6 rounded-full grid place-items-center text-[10px] font-medium text-white shrink-0 overflow-hidden cursor-pointer"
                        style={{ backgroundColor: reply.user.avatarColor }}
                        onClick={() => reply.userId && navigate(`/profile/${reply.username || reply.userId}`)}
                      >
                        {reply.user.avatar ? (
                          <img src={reply.user.avatar} alt={reply.user.initials} className="w-full h-full object-cover" />
                        ) : (
                          reply.user.initials
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="font-medium text-xs text-foreground cursor-pointer hover:underline"
                            onClick={() => reply.userId && navigate(`/profile/${reply.username || reply.userId}`)}
                          >{reply.user.name}</span>
                          {reply.user.verified && <BadgeCheck className="size-3 text-secondary" />}
                          <span className="text-xs text-muted-foreground">{reply.timestamp}</span>
                        </div>
                        {(() => {
                          const replyGiftMeta = parseGiftComment(reply.text);
                          if (replyGiftMeta) {
                            return <GiftCommentCard metadata={replyGiftMeta} className="mb-1.5" />;
                          }
                          return <p className="text-xs text-foreground mb-1">{reply.text}</p>;
                        })()}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLikeComment(reply.id);
                          }}
                          className="flex items-center gap-1 text-xs font-medium hover:text-[#F43774] active:scale-[0.93] transition-all duration-150"
                        >
                          <Heart
                            strokeWidth={1.85}
                            className={`size-3.5 transition-colors duration-200 ${reply.isLiked ? 'fill-[#F43774] text-[#F43774]' : 'text-[#71829A]'}`}
                          />
                          {reply.likes > 0 && <span className={reply.isLiked ? 'text-[#F43774]' : 'text-[#71829A]'}>{reply.likes}</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Mini Animated Gift Celebration — centered above the comment input area */}
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

            if (!record || !user) {
              giftInFlightRef.current = false;
              setIsGiftSending(false);
              return;
            }

            try {
              let finalized = await finalizePendingGiftComment(record);
              if (!finalized) {
                // Retry once after a short delay if network hiccupped
                await new Promise((r) => setTimeout(r, 500));
                finalized = await finalizePendingGiftComment(record);
              }

              if (finalized) {
                setComments((prev) => {
                  if (
                    prev.some(
                      (c) =>
                        c.id === finalized!.id ||
                        c.text.includes(record.transactionId || record.requestId)
                    )
                  ) {
                    return prev;
                  }
                  const giftCommentItem: Comment = {
                    id: finalized!.id,
                    userId: user.id,
                    username: user.username,
                    user: {
                      name: user.name,
                      initials: user.initials,
                      avatarColor: user.avatarColor,
                      avatar: user.avatar,
                      verified: user.isVerified,
                    },
                    text: finalized!.content,
                    timestamp: 'Just now',
                    likes: 0,
                    replies: 0,
                    isLiked: false,
                  };
                  return [giftCommentItem, ...prev];
                });
                setCommentsOpen(true);
                triggerHaptic('light');
                invalidateWallet();
                queryClient.invalidateQueries({ queryKey: ['feed'] });
                queryClient.invalidateQueries({ queryKey: ['posts'] });
                queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
              }
            } finally {
              giftInFlightRef.current = false;
              setIsGiftSending(false);
            }
          }}
        />
      )}

      {/* Floating Comment Input — hidden for viewers outside a friends-only audience */}
      {canInteract ? (
        <PersistentCommentComposer
          onSubmit={(text) => handleCommentSubmit(text)}
          recipientId={post?.user_id}
          recipientName={post?.profiles?.name || post?.name}
          isGiftSending={isGiftSending}
          onGiftSend={async (gift: GiftEmoji) => {
            if (!post?.user_id || !user || !postId) return;
            if (giftInFlightRef.current) return;

            const quantity = gift.quantity ?? 1;
            const totalValue = gift.value * quantity;
            const currentBalance = wallet?.balance ?? 0;

            if (currentBalance < totalValue) {
              toast.error(`Not enough coins. You need ${totalValue} coins but have ${currentBalance}.`);
              return;
            }

            giftInFlightRef.current = true;
            setIsGiftSending(true);
            const requestId = crypto.randomUUID();

            try {
              const txResult = await transferCoins.mutateAsync({
                receiverId: post.user_id,
                amount: totalValue,
                typeSent: 'tip_sent',
                typeReceived: 'tip_received',
                referenceId: postId,
                description: `Gift ${gift.emoji} ${gift.label} on post`,
                requestId,
              });

              const transactionId = String((txResult as any)?.requestId || requestId);
              const pendingRecord: PendingGiftCommentRecord = {
                requestId,
                transactionId,
                postId,
                userId: user.id,
                userName: user.name,
                giftId: gift.id || gift.label.toLowerCase(),
                giftName: gift.label,
                giftEmoji: gift.emoji,
                giftImage: gift.image,
                quantity,
                coinValue: totalValue,
                createdAt: Date.now(),
              };

              // Persist durable pending gift comment immediately after confirmed payment
              savePendingGiftComment(pendingRecord);
              activeGiftRecordRef.current = pendingRecord;

              // Safety fallback timeout in case animation callback is interrupted
              const tier = getGiftAnimationTier(totalValue);
              if (giftFallbackTimerRef.current) clearTimeout(giftFallbackTimerRef.current);
              giftFallbackTimerRef.current = setTimeout(() => {
                if (activeGiftRecordRef.current?.requestId === requestId) {
                  void finalizePendingGiftComment(pendingRecord);
                }
              }, tier.durationMs + 450);

              // Trigger the gift celebration animation before revealing the comment
              setActiveGiftAnimation(pendingRecord);
            } catch (error) {
              console.error('Error sending gift:', error);
              giftInFlightRef.current = false;
              setIsGiftSending(false);
            }
          }}
        />
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-4 py-3 flex items-center justify-center gap-2 text-muted-foreground">
          <Lock className="size-4" />
          <span className="text-sm font-medium">Only friends and followers can reply to this post</span>
        </div>
      )}
      {/* Comment Action Menu */}
      <CommentActionMenu
        isOpen={!!commentAction}
        isOwn={true}
        position={commentAction?.position || { x: 0, y: 0 }}
        commentText={comments.find(c => c.id === commentAction?.commentId)?.text || ''}
        onClose={() => setCommentAction(null)}
        onEdit={(newText) => commentAction && handleEditComment(commentAction.commentId, newText)}
        onDelete={() => commentAction && handleDeleteComment(commentAction.commentId)}
      />
      <LikersModal isOpen={showLikersModal} onClose={() => setShowLikersModal(false)} postId={postId!} />
      <ReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onSubmit={handleReportPost}
        itemType="post"
      />
    </div>
  );
};

export default PostDetail;
