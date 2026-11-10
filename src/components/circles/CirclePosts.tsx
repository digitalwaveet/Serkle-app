import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { uploadImageWithPreviews } from '@/lib/imageStorage';
import { imageUploadId } from '@/lib/imageAsset';
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CircleLockedCover, CirclePremiumBadge } from './CirclePostPreview';
import { circlePostExcerpt, makeCirclePreviewImages } from '@/lib/circlePostPreview';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import TiptapUnderline from '@tiptap/extension-underline';
import TiptapLink from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { MessageCircle, Crown, MoreVertical, Trash2, Image as ImageIcon, Coins, Send, X, Bold, Italic, Underline as UnderlineIcon, List, Heading1, Heading2, Link as LinkIcon, Pencil, AlignLeft, AlignCenter, AlignRight, AlignJustify, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';
import { TipButton } from './TipButton';
import { PremiumSettingsModal } from './PremiumSettingsModal';
import { SubscribeCircleModal } from './SubscribeCircleModal';
import { EditPostModal } from './EditPostModal';
import { useCirclePosts } from '@/hooks/useCirclePosts';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PostReactionButton from '@/components/post/PostReactionButton';
import LikersModal from '@/components/LikersModal';
import CircleEmptyState from './CircleEmptyState';

interface CirclePostsProps {
  circle: any;
  isOwner: boolean;
}

const CirclePosts: React.FC<CirclePostsProps> = ({ circle, isOwner }) => {
  const navigate = useNavigate();
  const { id: circleId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();

  // Owners/admins always post; members only when the circle allows it
  const canPost = isOwner || (circle?.posting_policy === 'members' && circle?.is_joined);

  // Inline Composer State
  const [content, setContent] = useState('');
  const composerManager = useFileManager();
  const coverImage = composerManager.files[0]?.file as File | undefined;
  const coverPreview = composerManager.files[0]?.url || '';
  const [isPremium, setIsPremium] = useState(false);
  const [premiumPrice, setPremiumPrice] = useState('50');
  const [hasTipsEnabled, setHasTipsEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPostForEdit, setSelectedPostForEdit] = useState<any>(null);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  // Initialize Tiptap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      TiptapUnderline,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[80px] w-full text-base text-foreground',
      },
    },
  });

  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  
  const { data: posts = [], isLoading, isError: isPostsError, refetch: retryPosts } = useCirclePosts(circleId);

  const removeImage = () => {
    composerManager.clearAll();
  };

  const handleSubmit = async () => {
    if (!content.trim() && !coverImage) {
      toast({ title: "Content required", description: "Please write something or add an image", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let coverImageUrl = null;
      if (coverImage) {
        coverImageUrl = await uploadImageWithPreviews('post-media', user.id, coverImage, imageUploadId(coverImage));
      }

      const previews = isPremium && coverImage ? await makeCirclePreviewImages(coverImage) : {};

      const { error: postError } = await supabase.from('posts').insert({
        user_id: user.id,
        circle_id: circleId,
        content: content.trim(),
        cover_image_url: coverImageUrl,
        is_premium: isPremium,
        premium_price: isPremium ? parseInt(premiumPrice) : null,
        has_tips_enabled: hasTipsEnabled,
        ...previews,
      });

      if (postError) throw postError;

      toast({ title: "Post published!", description: isPremium ? `Premium post set at ${premiumPrice} coins` : "Your post is now live" });
      
      // Reset state
      composerManager.clearAll();
      setIsPremium(false);
      setHasTipsEnabled(true);
      editor?.commands.setContent('');
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['circle-posts', circleId] });
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({ title: "Failed to publish", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean, reactionType: string = 'like') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please log in to like posts", variant: "destructive" });
        return;
      }

      const isRemoving = isLiked && (reactionType === 'like' || !reactionType);
      
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
      queryClient.invalidateQueries({ queryKey: ['circle-posts', circleId] });
      queryClient.invalidateQueries({ queryKey: ['circle-post', postId] });
    } catch (error: any) {
      console.error('Error liking post:', error);
      toast({ title: "Failed to like post", description: error.message, variant: "destructive" });
    }
  };

  const handleTip = async (postId: string, amount: number, recipientId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please log in to tip", variant: "destructive" });
        return;
      }
      await supabase.from('circle_tips').insert({
        post_id: postId,
        tipper_id: user.id,
        recipient_id: recipientId,
        amount,
      });
      queryClient.invalidateQueries({ queryKey: ['circle-posts', circleId] });
      toast({ title: "Tip sent successfully!", description: `You tipped ${amount} coins` });
    } catch (error: any) {
      console.error('Error sending tip:', error);
      toast({ title: "Failed to send tip", description: error.message, variant: "destructive" });
    }
  };

  const handleTogglePin = async (post: any) => {
    try {
      const { error } = await supabase.rpc('set_circle_post_pinned', {
        _post_id: post.id,
        _pinned: !post.pinned_at,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['circle-posts', circleId] });
      toast({ title: post.pinned_at ? 'Post unpinned' : 'Post pinned to top' });
    } catch (error: any) {
      console.error('Error toggling pin:', error);
      toast({ title: 'Failed to update pin', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please log in to delete posts", variant: "destructive" });
        return;
      }
      const query = supabase.from('posts').delete().eq('id', postId);
      if (!isOwner) query.eq('user_id', user.id);
      const { error } = await query;
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['circle-posts', circleId] });
      toast({ title: "Post deleted successfully" });
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast({ title: "Failed to delete post", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-0 scroll-smooth">
      {/* Inline Post Composer — owners always, members when the circle allows it */}
      {canPost && (
        <div className="px-4 py-5 border-b border-border/50 animate-fade-in">
          <div className="bg-card rounded-2xl border border-border shadow-soft">
            <div className="p-4">
              <div className="flex gap-3">
                {/* Creator crown for owners, the member's own avatar otherwise */}
                <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground flex-shrink-0 overflow-hidden">
                  {isOwner ? (
                    <Crown className="w-5 h-5" />
                  ) : currentUser?.avatar ? (
                    <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold">{currentUser?.initials || '?'}</span>
                  )}
                </div>

                {/* Text Area / Rich Text Editor */}
                <div className="flex-1 space-y-3 pt-1 min-h-[80px] min-w-0">
                  {editor && (
                    <BubbleMenu editor={editor} className="flex items-center gap-0.5 p-1 bg-popover border border-border rounded-xl shadow-elegant">
                      <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded-lg transition-all ${editor.isActive('bold') ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}><Bold className="w-3.5 h-3.5" /></button>
                      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded-lg transition-all ${editor.isActive('italic') ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}><Italic className="w-3.5 h-3.5" /></button>
                      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded-lg transition-all ${editor.isActive('underline') ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}><UnderlineIcon className="w-3.5 h-3.5" /></button>
                      <div className="w-px h-3.5 bg-border mx-0.5" />
                      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-1.5 rounded-lg transition-all ${editor.isActive('heading', { level: 1 }) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}><Heading1 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded-lg transition-all ${editor.isActive('bulletList') ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}><List className="w-3.5 h-3.5" /></button>
                      <div className="w-px h-3.5 bg-border mx-0.5" />
                      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-1.5 rounded-lg transition-all ${editor.isActive({ textAlign: 'left' }) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}><AlignLeft className="w-3.5 h-3.5" /></button>
                      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-1.5 rounded-lg transition-all ${editor.isActive({ textAlign: 'center' }) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}><AlignCenter className="w-3.5 h-3.5" /></button>
                      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-1.5 rounded-lg transition-all ${editor.isActive({ textAlign: 'right' }) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}><AlignRight className="w-3.5 h-3.5" /></button>
                      <div className="w-px h-3.5 bg-border mx-0.5" />
                      <button
                        onClick={() => {
                          const url = window.prompt('URL');
                          if (url) editor.chain().focus().setLink({ href: url }).run();
                        }}
                        className={`p-1.5 rounded-lg transition-all ${editor.isActive('link') ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                      </button>
                    </BubbleMenu>
                  )}

                  <div className="relative">
                    {!content.trim() || content === '<p></p>' ? (
                      <div className="absolute top-0 left-0 text-muted-foreground text-base pointer-events-none">
                        {isOwner ? 'Share something with your members...' : 'Share something with the circle...'}
                      </div>
                    ) : null}
                    <EditorContent editor={editor} />
                  </div>

                  {/* Image Preview */}
                  {coverPreview && (
                    <div className="relative w-full h-40 rounded-xl overflow-hidden border border-border group/img">
                      <img src={coverPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-colors"
                        aria-label="Remove image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  </div>
                </div>
              </div>
              
              {/* Actions Bar */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Add Image */}
                  <CustomFilePicker manager={composerManager} hideUploadButton hidePreviewList accept="image/*" maxFileSizeMB={5}>
                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer flex-shrink-0">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Image</span>
                    </button>
                  </CustomFilePicker>

                  {/* Premium Toggle — creator monetization, owners only */}
                  {isOwner && (
                  <button
                    onClick={() => {
                      if (!isPremium) {
                        setIsPremiumModalOpen(true);
                      } else {
                        setIsPremium(false);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors flex-shrink-0 ${
                      isPremium
                        ? 'bg-secondary/15 text-secondary ring-1 ring-secondary/40'
                        : 'bg-muted text-muted-foreground hover:bg-secondary/10 hover:text-secondary'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{isPremium ? `${premiumPrice} coins` : 'Premium'}</span>
                  </button>
                  )}

                  {/* Tips Toggle */}
                  <button
                    onClick={() => setHasTipsEnabled(!hasTipsEnabled)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors flex-shrink-0 ${
                      hasTipsEnabled
                        ? 'bg-success/15 text-success ring-1 ring-success/40'
                        : 'bg-muted text-muted-foreground hover:bg-success/10 hover:text-success'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Tips</span>
                  </button>
                </div>

                {/* Post Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || (!content.trim() && !coverImage)}
                  size="sm"
                  className="rounded-full px-5 flex-shrink-0"
                >
                  {isSubmitting ? (
                    <SerkleLoader size="xs" className="text-primary-foreground" />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span>Post</span>
                      <Send className="w-3.5 h-3.5" />
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* Section Header */}
      <div className="px-6 py-4 bg-background/50 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Posts</h2>
          <div className="h-1 w-12 bg-gradient-primary rounded-full"></div>
        </div>
      </div>

      {/* Posts Grid Container */}
      <div className="bg-muted/20 min-h-screen">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground">Loading posts...</div>
          </div>
        ) : isPostsError ? (<div className="p-6 text-center"><p>Could not verify access.</p><Button onClick={() => retryPosts()}>Retry</Button></div>) : posts.length === 0 ? (
          <CircleEmptyState
            icon={MessageCircle}
            title="No Posts Yet"
            description="Share updates, photos, or questions with your circle."
            ownerTitle="Share your first post"
            ownerDescription="Welcome your members, pin an announcement or start a discussion using the composer above."
            isOwner={isOwner}
          />
        ) : (
          <div className="px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {posts.map(post => {
                const locked = post.is_premium && !post.user_has_unlocked;
                const detailPath = '/circle/' + circleId + '/post/' + post.id;
                const excerpt = locked ? post.previewText : circlePostExcerpt(post.content ?? '');
                const cover = !locked && (post.coverReference || (post.post_type === 'photo' ? post.mediaUrl : null));

                return (
                  <article key={post.id} className="flex w-full min-w-0 max-w-[440px] flex-col gap-3 self-start justify-self-center rounded-[20px] border border-border bg-card p-4 text-card-foreground shadow-soft">
                    <header className="flex flex-wrap items-center gap-2">
                      <Avatar className="size-9">
                        <AvatarImage src={post.author.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{post.author.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{post.author.name}</p>
                        <time dateTime={post.created_at} className="block text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </time>
                      </div>
                      {post.is_premium && <CirclePremiumBadge locked={locked} />}
                      {isOwner && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label="Post options">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleTogglePin(post)}>
                              {post.pinned_at ? <PinOff className="mr-2 size-4" /> : <Pin className="mr-2 size-4" />}
                              {post.pinned_at ? 'Unpin Post' : 'Pin to Top'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedPostForEdit(post);
                              setIsEditModalOpen(true);
                            }}>
                              <Pencil className="mr-2 size-4" /> Edit Post
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeletePost(post.id)} className="text-destructive">
                              <Trash2 className="mr-2 size-4" /> Delete Post
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </header>

                    {post.pinned_at && <span className="inline-flex items-center gap-1 self-start text-xs font-semibold text-primary"><Pin className="size-3" />Pinned</span>}

                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold leading-tight tracking-tight">
                        <Link to={detailPath} className="rounded-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                          {locked ? 'Premium post' : circle.name + '’s post'}
                        </Link>
                      </h3>
                      {excerpt && <p className="mt-1 line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">{excerpt}</p>}
                    </div>

                    {locked ? (
                      <>
                        <Link to={detailPath} aria-label="Open premium post preview" className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                          <CircleLockedCover thumbnail={post.previewImage} />
                        </Link>
                        <div className="grid gap-2">
                          {post.premium_price != null && post.premium_price > 0 && (
                            <Button asChild className="min-h-11 rounded-xl">
                              <Link to={detailPath}>Unlock for {post.premium_price} coins</Link>
                            </Button>
                          )}
                          {circle.subscription_enabled && (
                            <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setSubscribeModalOpen(true)}>
                              View subscription
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {cover && <OptimizedImage src={cover} alt="Post cover" className="w-full rounded-xl" imageClassName="object-cover" style={{ aspectRatio: '2.24' }} onOpen={() => navigate(detailPath)} openLabel="Open post" />}
                        <footer className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <PostReactionButton
                            isLiked={post.user_has_liked}
                            likesCount={post.stats.likes_count}
                            userReaction={post.user_reaction}
                            onLike={(reactionType) => handleLike(post.id, post.user_has_liked, reactionType)}
                            onShowLikers={() => {
                              setActivePostId(post.id);
                              setShowLikersModal(true);
                            }}
                          />
                          <Link to={detailPath} state={{ openComments: true }} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                            <MessageCircle aria-hidden="true" className="size-4" />
                            {post.stats.comments_count} {post.stats.comments_count === 1 ? 'reply' : 'replies'}
                          </Link>
                          {currentUser && currentUser.id !== post.user_id && post.has_tips_enabled && (
                            <div className="ml-auto">
                              <TipButton
                                postId={post.id}
                                authorName={post.author.name}
                                tipCount={post.tip_count}
                                userHasTipped={post.user_has_tipped}
                                variant="card"
                                onTip={(amount) => handleTip(post.id, amount, post.user_id)}
                              />
                            </div>
                          )}
                        </footer>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Spacer for better scroll experience */}
        <div className="h-24 flex items-center justify-center">
          <div className="w-16 h-1 bg-muted rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Modals */}
      <PremiumSettingsModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        price={premiumPrice}
        setPrice={setPremiumPrice}
        onSave={() => {
          setIsPremium(true);
          setIsPremiumModalOpen(false);
        }}
      />

      <SubscribeCircleModal
        isOpen={subscribeModalOpen}
        onClose={() => setSubscribeModalOpen(false)}
        circleId={circleId || ''}
        circleName={circle?.name || 'this circle'}
        subscriptionPrice={circle?.subscription_price}
        onSubscribed={() => {
          queryClient.invalidateQueries({ queryKey: ['circle-subscription', circleId] });
        }}
      />

      {isEditModalOpen && <EditPostModal
        key={selectedPostForEdit?.id}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        post={selectedPostForEdit}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['circle-posts', circleId] });
          queryClient.invalidateQueries({ queryKey: ['circle-post', selectedPostForEdit?.id] });
        }}
      />}
      <LikersModal 
        isOpen={showLikersModal} 
        onClose={() => setShowLikersModal(false)} 
        postId={activePostId || ''} 
      />
    </div>
  );
};

export default CirclePosts;
