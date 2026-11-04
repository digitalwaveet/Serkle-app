import React, { useState, useRef, useEffect } from 'react';
import { X, Heart, MessageCircle, Share, Send } from 'lucide-react';
import EmojiPicker from '@/components/EmojiPicker';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useVideoMutations } from '@/hooks/useVideoMutations';
import { useUser } from '@/contexts/UserContext';
import { GiftEmojiPicker, GiftEmoji } from '@/components/GiftEmojiPicker';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import CommentActionMenu from '@/components/CommentActionMenu';
import { toast } from 'sonner';
import { RichTextRenderer } from '@/components/RichTextRenderer';

interface Comment {
  id: string;
  userId?: string;
  user: {
    name: string;
    initials: string;
    avatarColor: string;
    avatarUrl?: string;
    verified?: boolean;
  };
  text: string;
  likes: number;
  replies: number;
  timestamp: string;
  isLiked?: boolean;
  parentId?: string;
}

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
  totalComments: number;
  onHeightChange?: (height: number) => void;
  videoOwnerId?: string;
  videoOwnerName?: string;
}


const formatCount = (count: number): string => {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

export const CommentsModal: React.FC<CommentsModalProps> = ({
  isOpen,
  onClose,
  videoId,
  videoTitle,
  totalComments,
  onHeightChange,
  videoOwnerId,
  videoOwnerName
}) => {
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [localCommentCount, setLocalCommentCount] = useState(totalComments);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { addComment: addCommentMutation } = useVideoMutations();
  const { transferCoins } = useCoinWallet(user?.id);
  const [commentAction, setCommentAction] = useState<{ commentId: string; position: { x: number; y: number } } | null>(null);
  
  const DISMISS_THRESHOLD = 80;
  const SPRING_BACK_THRESHOLD = 40;

  // Fetch comments from database
  useEffect(() => {
    const fetchComments = async () => {
      if (!isOpen || !videoId) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_video_comments', {
          _video_id: videoId
        });

        if (error) throw error;

        const formattedComments: Comment[] = (data || []).map((comment: any) => ({
          id: comment.comment_id,
          userId: comment.user_id,
          user: {
            name: comment.name,
            initials: comment.initials,
            avatarColor: comment.avatar_color,
            avatarUrl: comment.avatar_url,
            verified: false
          },
          text: comment.content,
          likes: Number(comment.likes_count),
          replies: 0,
          timestamp: formatTimestamp(comment.created_at),
          isLiked: comment.user_has_liked,
          parentId: comment.parent_id
        }));

        // Compute reply counts
        const replyCounts = new Map<string, number>();
        formattedComments.forEach(c => {
          if (c.parentId) {
            replyCounts.set(c.parentId, (replyCounts.get(c.parentId) || 0) + 1);
          }
        });
        formattedComments.forEach(c => {
          c.replies = replyCounts.get(c.id) || 0;
        });

        setComments(formattedComments);
        setLocalCommentCount(formattedComments.length);
      } catch (error) {
        console.error('Error fetching comments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [isOpen, videoId]);

  // Real-time subscription for new comments
  useEffect(() => {
    if (!isOpen || !videoId) return;

    const channel = supabase
      .channel(`video-comments-${videoId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_comments',
        filter: `video_id=eq.${videoId}`
      }, () => {
        // Refetch comments when changes occur
        const refetch = async () => {
          const { data } = await supabase.rpc('get_video_comments', {
            _video_id: videoId
          });
          if (data) {
            const formattedComments: Comment[] = data.map((comment: any) => ({
              id: comment.comment_id,
              userId: comment.user_id,
              user: {
                name: comment.name,
                initials: comment.initials,
                avatarColor: comment.avatar_color,
                avatarUrl: comment.avatar_url,
                verified: false
              },
              text: comment.content,
              likes: Number(comment.likes_count),
              replies: 0,
              timestamp: formatTimestamp(comment.created_at),
              isLiked: comment.user_has_liked,
              parentId: comment.parent_id
            }));
            // Compute reply counts
            const replyCounts = new Map<string, number>();
            formattedComments.forEach(c => {
              if (c.parentId) {
                replyCounts.set(c.parentId, (replyCounts.get(c.parentId) || 0) + 1);
              }
            });
            formattedComments.forEach(c => {
              c.replies = replyCounts.get(c.id) || 0;
            });
            setComments(formattedComments);
            setLocalCommentCount(formattedComments.length);
          }
        };
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, videoId]);

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  // Enhanced swipe gestures for smooth dismiss
  const swipeHandlers = useSwipeGestures({
    onSwipeDown: () => {
      // Only trigger if not scrolling content
      if (!isScrollAtTop()) return;
      handleClose();
    },
  }, { 
    threshold: 100 
  });

  const isScrollAtTop = () => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return true;
    return scrollArea.scrollTop <= 0;
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setDragOffset(0);
    }, 200);
  };

  const handleLikeComment = async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    // Optimistic update
    setComments(prev => prev.map(c => 
      c.id === commentId 
        ? { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 }
        : c
    ));

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      if (comment.isLiked) {
        await supabase
          .from('video_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', authUser.id);
      } else {
        await supabase
          .from('video_comment_likes')
          .insert({ comment_id: commentId, user_id: authUser.id });
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
      const { error } = await supabase.from('video_comments').update({ content: newText }).eq('id', commentId);
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
    setLocalCommentCount(prev => prev - 1);
    try {
      const { error } = await supabase.from('video_comments').delete().eq('id', commentId);
      if (error) throw error;
      toast.success('Comment deleted');
    } catch {
      setComments(prev => [...prev, comment]);
      setLocalCommentCount(prev => prev + 1);
      toast.error('Failed to delete comment');
    }
  };

  const handleSendGift = async (gift: GiftEmoji) => {
    if (!user || !videoOwnerId) return;
    
    try {
      // Transfer coins to video owner
      await transferCoins.mutateAsync({
        receiverId: videoOwnerId,
        amount: gift.value,
        typeSent: 'tip_sent',
        typeReceived: 'tip_received',
        description: `Gift ${gift.emoji} ${gift.label} on video`,
      });

      // Post gift as a comment
      const giftComment = `${gift.emoji} sent a ${gift.label} gift (${gift.value} 🪙)`;
      
      const optimisticComment: Comment = {
        id: `temp-gift-${Date.now()}`,
        user: {
          name: user.name,
          initials: user.initials,
          avatarColor: user.avatarColor,
          avatarUrl: user.avatar,
        },
        text: giftComment,
        likes: 0,
        replies: 0,
        timestamp: 'now',
        isLiked: false,
      };
      setComments(prev => [...prev, optimisticComment]);
      setLocalCommentCount(prev => prev + 1);

      await addCommentMutation(videoId, giftComment);
    } catch (error) {
      console.error('Error sending gift:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    
    const commentText = newComment.trim();
    setNewComment('');

    // Optimistic update - add comment instantly
    const optimisticComment: Comment = {
      id: `temp-${Date.now()}`,
      user: {
        name: user.name,
        initials: user.initials,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatar,
      },
      text: commentText,
      likes: 0,
      replies: 0,
      timestamp: 'now',
      isLiked: false,
    };
    setComments(prev => [...prev, optimisticComment]);
    setLocalCommentCount(prev => prev + 1);

    try {
      await addCommentMutation(videoId, commentText);
      // Realtime subscription will refetch and replace the optimistic comment
    } catch (error) {
      // Revert optimistic update on error
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      setLocalCommentCount(prev => prev - 1);
      console.error('Error adding comment:', error);
    }
  };

  const handleAddReply = async (parentId: string) => {
    if (!replyText.trim() || !user) return;

    const replyContent = replyText.trim();
    setReplyText('');
    setReplyingTo(null);

    // Optimistic update for reply
    const optimisticReply: Comment = {
      id: `temp-reply-${Date.now()}`,
      user: {
        name: user.name,
        initials: user.initials,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatar,
      },
      text: replyContent,
      likes: 0,
      replies: 0,
      timestamp: 'now',
      isLiked: false,
      parentId,
    };
    setComments(prev => {
      const updated = [...prev, optimisticReply];
      // Update parent reply count
      return updated.map(c => c.id === parentId ? { ...c, replies: c.replies + 1 } : c);
    });
    setLocalCommentCount(prev => prev + 1);

    try {
      await addCommentMutation(videoId, replyContent, parentId);
    } catch (error) {
      setComments(prev => prev.filter(c => c.id !== optimisticReply.id).map(c => c.id === parentId ? { ...c, replies: c.replies - 1 } : c));
      setLocalCommentCount(prev => prev - 1);
      console.error('Error adding reply:', error);
    }
  };

  // Enhanced touch handlers for smooth drag-to-dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow dragging from header and never from interactive elements
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('textarea, input, button, a, [role="textbox"], [contenteditable], [data-no-drag]');
    if (isInteractive) return; // allow focusing/typing

    const isHeader = target.closest('[data-modal-header]');
    if (!isHeader && !isScrollAtTop()) return;

    // Begin drag gesture
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setDragOffset(0);

    // Disable body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    // Always prevent default and stop propagation to avoid page refresh
    e.preventDefault();
    e.stopPropagation();
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    
    // Only allow downward movement
    if (deltaY < 0) return;
    
    // Improved resistance curve - less resistance for easier dismissal
    let adjustedOffset = deltaY;
    
    // Apply gentle resistance only after threshold to maintain natural feel
    if (deltaY > DISMISS_THRESHOLD) {
      const excessDrag = deltaY - DISMISS_THRESHOLD;
      const resistance = Math.max(0.3, 1 - (excessDrag / 100)); // Gentler resistance
      adjustedOffset = DISMISS_THRESHOLD + (excessDrag * resistance);
    }
    
    setDragOffset(adjustedOffset);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    // Prevent default and stop propagation
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(false);
    
    // Re-enable body scroll
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    
    console.log('Touch end - dragOffset:', dragOffset, 'threshold:', DISMISS_THRESHOLD);
    
    if (dragOffset >= DISMISS_THRESHOLD) { // Changed to >= for easier dismissal
      // Close modal with animation
      console.log('Closing modal');
      handleClose();
    } else {
      // Spring back to original position
      console.log('Springing back');
      setDragOffset(0);
    }
  };

  // Mouse handlers for desktop support
  const handleMouseStart = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('textarea, input, button, a, [role="textbox"], [contenteditable], [data-no-drag]');
    if (isInteractive) return; // allow focusing/typing/clicking controls

    const isHeader = target.closest('[data-modal-header]');
    if (!isHeader && !isScrollAtTop()) return;

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setStartY(e.clientY);
    setDragOffset(0);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const currentY = e.clientY;
      const deltaY = currentY - startY;
      
      if (deltaY < 0) return;
      
      // Same improved resistance curve for mouse
      let adjustedOffset = deltaY;
      
      if (deltaY > DISMISS_THRESHOLD) {
        const excessDrag = deltaY - DISMISS_THRESHOLD;
        const resistance = Math.max(0.3, 1 - (excessDrag / 100));
        adjustedOffset = DISMISS_THRESHOLD + (excessDrag * resistance);
      }
      
      setDragOffset(adjustedOffset);
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      setIsDragging(false);
      
      if (dragOffset >= DISMISS_THRESHOLD) { // Changed to >= for easier dismissal
        handleClose();
      } else {
        setDragOffset(0);
      }
    };

    const handleTouchMoveGlobal = (e: TouchEvent) => {
      if (!isDragging) return;
      
      // Always prevent default to stop pull-to-refresh
      e.preventDefault();
      e.stopPropagation();
      
      if (e.touches.length === 0) return;
      
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      if (deltaY < 0) return;
      
      // Same improved resistance curve
      let adjustedOffset = deltaY;
      
      if (deltaY > DISMISS_THRESHOLD) {
        const excessDrag = deltaY - DISMISS_THRESHOLD;
        const resistance = Math.max(0.3, 1 - (excessDrag / 100));
        adjustedOffset = DISMISS_THRESHOLD + (excessDrag * resistance);
      }
      
      setDragOffset(adjustedOffset);
    };

    const handleTouchEndGlobal = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      setIsDragging(false);
      
      // Re-enable body scroll
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      
      if (dragOffset >= DISMISS_THRESHOLD) { // Changed to >= for easier dismissal
        handleClose();
      } else {
        setDragOffset(0);
      }
    };

    // Add event listeners with passive: false to ensure preventDefault works
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });
    document.addEventListener('touchend', handleTouchEndGlobal, { passive: false });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMoveGlobal);
      document.removeEventListener('touchend', handleTouchEndGlobal);
      
      // Cleanup body styles
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isDragging, startY, dragOffset]);

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setDragOffset(0);
      setIsDragging(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const dismissProgress = Math.min(1, dragOffset / DISMISS_THRESHOLD);
  const opacity = 1 - (dismissProgress * 0.3);
  const scale = 1 - (dismissProgress * 0.05);

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[100] bg-background transition-all duration-300 no-pull-refresh",
        isClosing && "animate-fade-out"
      )}
      style={{
        transform: `translateY(${dragOffset}px)`,
        opacity: opacity,
        transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        touchAction: 'none', // Prevent pull-to-refresh
        overscrollBehavior: 'none' // Prevent overscroll effects
      }}
    >
      {/* Modal positioned fullscreen */}
      <div 
        ref={modalRef}
        className={cn(
          "flex flex-col h-full bg-background overflow-hidden",
          isDragging && "select-none"
        )}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          touchAction: 'none', // Prevent any touch actions
          overscrollBehavior: 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseStart}
      >
        {/* Drag indicator */}
        {dragOffset > SPRING_BACK_THRESHOLD && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
            <div className={cn(
              "w-12 h-1 rounded-full transition-all duration-200",
              dragOffset > DISMISS_THRESHOLD 
                ? "bg-red-500 shadow-red-500/50 shadow-lg" 
                : "bg-muted-foreground/30"
            )}>
              <div 
                className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-200"
                style={{ width: `${Math.min(100, (dragOffset / DISMISS_THRESHOLD) * 100)}%` }}
              />
            </div>
            <div className="text-timestamp text-center mt-1 text-muted-foreground">
              {dragOffset > DISMISS_THRESHOLD ? 'Release to close' : 'Pull to close'}
            </div>
          </div>
        )}

        {/* Header */}
        <div 
          data-modal-header
          className="flex items-center justify-between px-4 py-4 border-b border-border cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {formatCount(localCommentCount)} comments
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 bg-background hover:bg-background rounded-full transition-colors"
            aria-label="Close comments"
          >
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="px-4 py-2 space-y-4">
            {comments.filter(comment => !comment.parentId).map((comment) => (
              <div key={comment.id} className="space-y-3">
                {/* Main comment */}
                <div className="flex gap-3 cursor-pointer" onClick={(e) => handleCommentTap(comment.id, e)}>
                  {/* Avatar */}
                  <div 
                    className="size-8 rounded-full flex items-center justify-center text-timestamp font-medium text-white flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: comment.user.avatarColor }}
                  >
                    {comment.user.avatarUrl ? (
                      <img src={comment.user.avatarUrl} alt={comment.user.name} className="w-full h-full object-cover" />
                    ) : (
                      comment.user.initials
                    )}
                  </div>

                  {/* Comment content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                       <span className="text-username font-semibold text-foreground">
                         {comment.user.name}
                       </span>
                       {comment.user.verified && (
                         <div className="size-3 bg-primary rounded-full flex items-center justify-center">
                           <div className="size-1.5 bg-card rounded-full" />
                         </div>
                       )}
                       <span className="text-timestamp text-muted-foreground ml-1">
                         {comment.timestamp}
                       </span>
                    </div>
                    
                     <p className="text-comment-text text-foreground mb-2 leading-relaxed">
                       <RichTextRenderer text={comment.text} />
                     </p>

                    {/* Comment actions */}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleLikeComment(comment.id)}
                         className={`flex items-center gap-1 text-action-label transition-colors ${
                           comment.isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
                         }`}
                       >
                         <Heart className={`size-3 ${comment.isLiked ? 'fill-current' : ''}`} />
                         {comment.likes > 0 && <span>{formatCount(comment.likes)}</span>}
                       </button>
                       
                       <button className="flex items-center gap-1 text-action-label text-muted-foreground hover:text-foreground transition-colors">
                        <MessageCircle className="size-3" />
                        {comment.replies > 0 && <span>{comment.replies}</span>}
                      </button>
                      
                      <button 
                        onClick={() => setReplyingTo(comment.id)}
                        className="text-action-label text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reply input for this comment */}
                {replyingTo === comment.id && (
                  <div className="ml-11 mt-3">
                    <div className="flex items-end gap-3 bg-background border border-border rounded-2xl p-3 shadow-lg">
                      <div className="flex-1 min-w-0">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Reply to ${comment.user.name}...`}
                           className="w-full bg-transparent text-comment-text placeholder:text-muted-foreground outline-none resize-none min-h-[24px] leading-6"
                          rows={1}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddReply(comment.id);
                            }
                            if (e.key === 'Escape') {
                              setReplyingTo(null);
                              setReplyText('');
                            }
                          }}
                          autoFocus
                         />
                      </div>
                      <EmojiPicker 
                        onEmojiSelect={(emoji) => setReplyText(prev => prev + emoji)}
                        variant="compact"
                      />
                      {replyText.trim() && (
                        <Button
                          onClick={() => handleAddReply(comment.id)}
                          size="sm"
                          className="px-3 py-2 h-8 bg-gradient-primary hover:bg-gradient-primary/90 text-primary-foreground shadow-glow"
                        >
                          <Send className="size-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                        variant="ghost"
                        size="sm"
                        className="px-2 py-1 h-7 text-action-label"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                 {/* Show replies */}
                {comments.filter(reply => reply.parentId === comment.id).map((reply) => (
                  <div key={reply.id} className="ml-11 flex gap-3 cursor-pointer" onClick={(e) => handleCommentTap(reply.id, e)}>
                    <div 
                      className="size-6 rounded-full flex items-center justify-center text-timestamp font-medium text-white flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: reply.user.avatarColor }}
                    >
                      {reply.user.avatarUrl ? (
                        <img src={reply.user.avatarUrl} alt={reply.user.name} className="w-full h-full object-cover" />
                      ) : (
                        reply.user.initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                         <span className="text-username font-semibold text-foreground">
                           {reply.user.name}
                         </span>
                         <span className="text-timestamp text-muted-foreground ml-1">
                           {reply.timestamp}
                         </span>
                      </div>
                       <p className="text-comment-text text-foreground mb-1 leading-relaxed">
                         {reply.text}
                       </p>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleLikeComment(reply.id)}
                           className={`flex items-center gap-1 text-action-label transition-colors ${
                             reply.isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
                           }`}
                        >
                          <Heart className={`size-3 ${reply.isLiked ? 'fill-current' : ''}`} />
                          {reply.likes > 0 && <span>{formatCount(reply.likes)}</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            </div>
          </ScrollArea>
        </div>

        {/* Comment input - sticky at bottom */}
        <div className="sticky bottom-0 bg-background border-t border-border z-10" data-no-drag style={{ touchAction: 'auto' }}>
          <div className="px-4 py-3">
            <div className="flex items-end gap-3 bg-background border border-border rounded-2xl p-3 shadow-lg">
              <div 
                className="size-8 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: user?.avatarColor || '#E08ED1' }}
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.initials} className="w-full h-full object-cover" />
                ) : (
                  user?.initials || 'U'
                )}
              </div>
              <div className="flex-1 min-w-0 relative z-10" onTouchStart={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full bg-transparent text-foreground text-sm placeholder:text-muted-foreground outline-none resize-none min-h-[24px] leading-6 relative z-10"
                  rows={1}
                  style={{ pointerEvents: 'auto' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                />
              </div>
              <EmojiPicker 
                onEmojiSelect={(emoji) => setNewComment(prev => prev + emoji)}
                variant="compact"
              />
              {/* Gift emoji picker */}
              {videoOwnerId && (
                <GiftEmojiPicker
                  onGiftSelect={handleSendGift}
                  recipientName={videoOwnerName}
                />
              )}
              {newComment.trim() && (
                <Button
                  onClick={handleAddComment}
                  size="sm"
                  className="px-3 py-2 h-8 bg-gradient-primary hover:bg-gradient-primary/90 text-primary-foreground shadow-glow"
                >
                  <Send className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
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
    </div>
  );
};