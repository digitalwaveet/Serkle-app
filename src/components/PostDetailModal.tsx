import React, { useState, useEffect } from 'react';
import { X, Heart, MessageCircle, Share, MoreHorizontal } from 'lucide-react';
import { Post, Comment, MOCK_COMMENTS } from '@/data/mock';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from '@/components/ui/carousel';

interface PostDetailModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
}

const formatTimeAgo = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
  return `${Math.floor(diffInMinutes / 1440)}d`;
};

const CommentItem: React.FC<{ comment: Comment }> = ({ comment }) => {
  return (
    <div className="flex gap-3 py-3">
      <div 
        className="size-8 rounded-full flex items-center justify-center text-timestamp font-medium text-white flex-shrink-0"
        style={{ backgroundColor: comment.user.avatarColor }}
      >
        {comment.user.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-username text-foreground">{comment.user.name}</span>
          <span className="text-timestamp text-muted-foreground">{comment.time}</span>
        </div>
        <p className="text-comment-text text-foreground leading-relaxed">{comment.content}</p>
        <div className="flex items-center gap-4 mt-2">
          <button 
            aria-label={`Like comment by ${comment.user.name}`}
            className="flex items-center gap-1 text-action-label text-muted-foreground hover:text-foreground"
          >
            <Heart className="size-3" />
            {comment.likes}
          </button>
          <button 
            aria-label={`Reply to ${comment.user.name}`}
            className="text-action-label text-muted-foreground hover:text-primary"
          >
            Reply
          </button>
        </div>
      </div>
    </div>
  );
};

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  isOpen,
  onClose,
}) => {
  const reducedMotion = useReducedMotion();
  const comments = MOCK_COMMENTS[post.id] || [];
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };

    carouselApi.on('select', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end"
      onClick={handleBackdropClick}
    >
      <div 
        className={cn(
          "w-full max-w-[480px] mx-auto bg-background rounded-t-3xl max-h-[90vh] overflow-hidden",
          reducedMotion 
            ? "animate-none" 
            : "animate-slide-up"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-detail-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 id="post-detail-title" className="font-semibold text-lg">Post</h2>
          <button
            onClick={onClose}
            aria-label="Close post detail"
            className="p-2 hover:bg-muted/50 rounded-full transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-60px)]">
          {/* Post content */}
          <div className="p-4">
            {/* User info */}
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="size-12 rounded-full flex items-center justify-center text-username font-medium text-white"
                style={{ backgroundColor: post.user.avatarColor }}
              >
                {post.user.initials}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{post.user.name}</span>
                  {post.user.verified && (
                    <div className="size-4 bg-primary rounded-full flex items-center justify-center">
                      <div className="size-2 bg-card rounded-full" />
                    </div>
                  )}
                  {post.sponsored && (
                    <span className="text-xs px-2 py-0.5 bg-muted/50 rounded-full text-muted-foreground">
                      Sponsored
                    </span>
                  )}
                </div>
                <p className="text-timestamp text-muted-foreground">{formatTimeAgo(post.time)}</p>
              </div>
              <button 
                aria-label="More options"
                className="p-2 hover:bg-muted/50 rounded-full transition-colors"
              >
                <MoreHorizontal className="size-5 text-muted-foreground" />
              </button>
            </div>

            {/* Post text - full content */}
            <div className="mb-4">
              {(/<[a-z][\s\S]*>/i.test(post.content) || post.content.includes('<p>') || post.content.includes('<strong>') || post.content.includes('<ul>')) ? (
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: post.content }} 
                />
              ) : (
                <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap break-words" dir="auto">
                  {post.content.split(' ').map((word, i) =>
                    word.startsWith('#') ? <span key={i} className="text-primary font-medium">{word} </span> : word + ' '
                  )}
                </p>
              )}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {post.tags.map((tag) => (
                    <span 
                      key={tag}
                      className="text-badge px-2 py-1 bg-tertiary text-primary rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Media */}
            {post.media && post.media.urls && post.media.urls.length > 0 ? (
              <div className="mb-4 relative">
                <Carousel className="w-full" setApi={setCarouselApi}>
                  <CarouselContent>
                    {post.media.urls.map((url, index) => (
                      <CarouselItem key={index}>
                        <img
                          src={url}
                          alt={`${post.media?.alt || 'Post image'} ${index + 1}`}
                          loading="lazy"
                          className="w-full rounded-2xl aspect-[4/5] object-cover"
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
                
                {post.media.urls.length > 1 && (
                  <>
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm z-20">
                      {currentSlide + 1} / {post.media.urls.length}
                    </div>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                      {post.media.urls.map((_, idx) => (
                        <div 
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-all ${
                            idx === currentSlide 
                              ? 'bg-card w-2.5' 
                              : 'bg-card/50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : post.media && post.media.url ? (
              <div className="mb-4">
                <img
                  src={post.media.url}
                  alt={post.media.alt}
                  loading="lazy"
                  className="w-full rounded-2xl aspect-[4/5] object-cover"
                />
              </div>
            ) : null}

            {/* Stats */}
            <div className="flex items-center justify-between py-3 border-b border-border mb-4">
              <div className="flex items-center gap-6">
                <button 
                  aria-label={`Like post by ${post.user.name}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Heart className="size-5" />
                  <span className="text-action-label">{post.stats.likes}</span>
                </button>
                
                <button 
                  aria-label={`Comment on post by ${post.user.name}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <MessageCircle className="size-5" />
                  <span className="text-action-label">{post.stats.comments}</span>
                </button>
                
                <button 
                  aria-label={`Share post by ${post.user.name}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-secondary transition-colors"
                >
                  <Share className="size-5" />
                  <span className="text-action-label">{post.stats.shares}</span>
                </button>
              </div>
            </div>

            {/* Comments section */}
            <div>
              <h3 className="font-semibold text-lg mb-4">
                Comments ({comments.length})
              </h3>
              
              {comments.length > 0 ? (
                <div className="space-y-1">
                  {comments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No comments yet. Be the first to comment!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};