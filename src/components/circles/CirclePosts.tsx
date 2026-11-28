import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { uploadImageWithPreviews } from '@/lib/imageStorage';
import { imageUploadId } from '@/lib/imageAsset';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CirclePreviewImage, CirclePremiumBadge } from './CirclePostPreview';
import { CircleHeadlineField } from './CircleHeadlineField';
import { circlePostExcerpt, makeCirclePreviewImages } from '@/lib/circlePostPreview';
import { useEditor, EditorContent } from '@tiptap/react';
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
import { useCircleSubscription } from '@/hooks/useCircleSubscription';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { purchaseCircleAccess, confirmCirclePostAccess, refreshCircleAccessQueries } from '@/lib/circlePayments';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';

interface CirclePostsProps {
  circle: any;
  isOwner: boolean;
  canPublish: boolean;
  canModerate: boolean;
}

const CirclePosts: React.FC<CirclePostsProps> = ({ circle, isOwner, canPublish, canModerate }) => {
  const navigate = useNavigate();
  const { id: circleId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();

  // Owners/admins always post; members only when the circle allows it
  const canPost = canPublish || (circle?.posting_policy === 'members' && circle?.is_joined);

  // Inline Composer State
  const [headline, setHeadline] = useState('');
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
        'aria-label': 'Body',
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[120px] w-full text-[15px] leading-7 text-foreground prose-headings:mb-2 prose-headings:mt-3 prose-headings:text-foreground prose-h1:text-2xl prose-h2:text-xl prose-p:my-2 prose-p:text-foreground prose-li:my-0.5 prose-li:text-foreground prose-ul:my-2 prose-ol:my-2 prose-a:text-primary',
      },
    },
  });

  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  
  const [unlockTargetPost, setUnlockTargetPost] = useState<any>(null);
  const [isUnlockingPost, setIsUnlockingPost] = useState(false);
  const unlockInFlightRef = useRef(false);
  const syncedSubRef = useRef(false);

  const { data: subscription } = useCircleSubscription(circleId);
  const hasActiveSubscription = !!subscription;
  const { wallet } = useCoinWallet(currentUser?.id);
  const { data: posts = [], isLoading, isError: isPostsError, refetch: retryPosts } = useCirclePosts(circleId);

  useEffect(() => {
    if ((hasActiveSubscription || isOwner) && posts.some((p) => p.is_premium && !p.user_has_unlocked)) {
      if (!syncedSubRef.current) {
        syncedSubRef.current = true;
        retryPosts();
      }
    } else {
      syncedSubRef.current = false;
    }
  }, [hasActiveSubscription, isOwner, posts, retryPosts]);

  const handleUnlockPostWithCoins = async (post: any) => {
    if (unlockInFlightRef.current || !post?.premium_price || post.premium_price <= 0) return;
    if (!currentUser) {
      toast({ title: 'Please log in to unlock', variant: 'destructive' });
      return;
    }
    unlockInFlightRef.current = true;
    setIsUnlockingPost(true);
    try {
      const result = await purchaseCircleAccess('post', post.id, {
        expectedPrice: post.premium_price,
        deferConfirmation: true,
      });
      const verification = await confirmCirclePostAccess(post.id);
      if (!verification.confirmed) {
        await refreshCircleAccessQueries(queryClient, { circleId, postId: post.id });
        const refreshed = await retryPosts();
        const unlockedNow = refreshed.data?.some((item) => item.id === post.id && item.user_has_unlocked);
        if (!unlockedNow) {
          toast({
            title: 'Access is still syncing',
            description: 'Your payment reference was kept safely. Retry this button to restore access without another charge.',
            variant: 'destructive',
          });
          return;
        }
      }
      result.confirm();
      await refreshCircleAccessQueries(queryClient, { circleId, postId: post.id });
      setUnlockTargetPost(null);
      toast({
        title: 'Post unlocked',
        description: result.charged
          ? `${result.charged} coins paid. Full post access is ready.`
          : result.recovered
            ? 'Your previous payment was restored. No additional coins were charged.'
            : 'Included in your existing access.',
      });
    } catch (error: any) {
      toast({ title: 'Unlock failed', description: error.message, variant: 'destructive' });
    } finally {
      unlockInFlightRef.current = false;
      setIsUnlockingPost(false);
    }
  };

  const removeImage = () => {
    composerManager.clearAll();
  };

  const handleSubmit = async () => {
    if (isSubmitting || !editor) return;
    if (!headline.trim() && editor.isEmpty && !coverImage) {
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
        circle_headline: headline.trim() || null,
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
      setHeadline('');
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
      const { error } = canModerate
        ? await supabase.rpc('remove_circle_feed_post', { _post_id: postId })
        : await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['circle-posts', circleId] });
      toast({ title: "Post deleted successfully" });
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast({ title: "Failed to delete post", description: error.message, variant: "destructive" });
    }
  };

  const formatButtonClass = (active: boolean) => cn(
    'flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'text-muted-foreground hover:bg-background hover:text-foreground',
  );

  return (
    <div className="space-y-0 scroll-smooth">
      {/* Inline Post Composer — owners always, members when the circle allows it */}
      {canPost && (
        <div className="border-b border-border/50 px-3 py-4 animate-fade-in sm:px-4 sm:py-5">
          <div className="mx-auto max-w-2xl overflow-hidden rounded-[22px] border border-border bg-card shadow-soft">
            <div className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Create for your Circle</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Share an update, lesson or announcement.</p>
                </div>
                <span className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-primary/[0.08] px-3 text-[11px] font-semibold text-primary">
                  Members
                </span>
              </div>
              <div className="flex gap-3">
                {/* Creator crown for owners, the member's own avatar otherwise */}
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-primary text-primary-foreground">
                  {isOwner ? (
                    <Crown className="w-5 h-5" />
                  ) : currentUser?.avatar ? (
                    <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold">{currentUser?.initials || '?'}</span>
                  )}
                </div>

                {/* Text Area / Rich Text Editor */}
                <div className="min-w-0 flex-1 space-y-3">
                  <CircleHeadlineField value={headline} onChange={setHeadline} disabled={isSubmitting} premium={isPremium} />
                  <p className="text-sm font-medium">Body</p>
                  {editor && (
                    <div aria-label="Rich text formatting" className="flex items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-muted/25 p-1.5">
                      <button type="button" aria-label="Bold" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} className={formatButtonClass(editor.isActive('bold'))}><Bold className="size-4" aria-hidden="true" /></button>
                      <button type="button" aria-label="Italic" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} className={formatButtonClass(editor.isActive('italic'))}><Italic className="size-4" aria-hidden="true" /></button>
                      <button type="button" aria-label="Underline" title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} className={formatButtonClass(editor.isActive('underline'))}><UnderlineIcon className="size-4" aria-hidden="true" /></button>
                      <div className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden="true" />
                      <button type="button" aria-label="Heading 1" title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={formatButtonClass(editor.isActive('heading', { level: 1 }))}><Heading1 className="size-4" aria-hidden="true" /></button>
                      <button type="button" aria-label="Heading 2" title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={formatButtonClass(editor.isActive('heading', { level: 2 }))}><Heading2 className="size-4" aria-hidden="true" /></button>
                      <button type="button" aria-label="Bullet list" title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} className={formatButtonClass(editor.isActive('bulletList'))}><List className="size-4" aria-hidden="true" /></button>
                      <div className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden="true" />
                      <button type="button" aria-label="Align left" title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={formatButtonClass(editor.isActive({ textAlign: 'left' }))}><AlignLeft className="size-4" aria-hidden="true" /></button>
                      <button type="button" aria-label="Align center" title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={formatButtonClass(editor.isActive({ textAlign: 'center' }))}><AlignCenter className="size-4" aria-hidden="true" /></button>
                      <button type="button" aria-label="Align right" title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={formatButtonClass(editor.isActive({ textAlign: 'right' }))}><AlignRight className="size-4" aria-hidden="true" /></button>
                      <button type="button" aria-label="Justify text" title="Justify text" onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={formatButtonClass(editor.isActive({ textAlign: 'justify' }))}><AlignJustify className="size-4" aria-hidden="true" /></button>
                      <div className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden="true" />
                      <button
                        type="button"
                        aria-label="Add or edit link"
                        title="Add or edit link"
                        onClick={() => {
                          const currentHref = editor.getAttributes('link').href || '';
                          const url = window.prompt('Paste link URL', currentHref);
                          if (url === null) return;
                          if (!url.trim()) editor.chain().focus().unsetLink().run();
                          else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
                        }}
                        className={formatButtonClass(editor.isActive('link'))}
                      >
                        <LinkIcon className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  <div className="relative rounded-2xl border border-border/80 bg-background/55 px-3 py-2.5 transition-colors focus-within:border-primary/40 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10">
                    {editor?.isEmpty ? (
                      <div className="pointer-events-none absolute left-3 top-3 text-[15px] text-muted-foreground">
                        What would you like to share?
                      </div>
                    ) : null}
                    <EditorContent editor={editor} />
                  </div>

                  {/* Image Preview */}
                  {coverPreview && (
                    <div className="group/img relative aspect-video max-h-56 w-full overflow-hidden rounded-2xl border border-border bg-muted">
                      <img src={coverPreview} alt="Selected post image" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur-md transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        aria-label="Remove image"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  </div>
                </div>
              </div>
              
              {/* Option B creator controls */}
              <div className={cn('grid gap-2 border-t border-border px-4 pt-4 sm:px-5', isOwner ? 'grid-cols-3' : 'grid-cols-2')}>
                <CustomFilePicker manager={composerManager} hideUploadButton hidePreviewList accept="image/*" maxFileSizeMB={5}>
                  <button
                    type="button"
                    className={cn(
                      'flex min-h-[68px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      coverImage
                        ? 'border-primary/30 bg-primary/[0.08] text-primary'
                        : 'border-border bg-muted/25 text-muted-foreground hover:border-primary/25 hover:bg-primary/[0.06] hover:text-primary',
                    )}
                  >
                    <ImageIcon className="size-5" aria-hidden="true" />
                    <span>{coverImage ? 'Change photo' : 'Photo'}</span>
                  </button>
                </CustomFilePicker>

                {isOwner && (
                  <button
                    type="button"
                    aria-pressed={isPremium}
                    onClick={() => {
                      if (!isPremium) {
                        setIsPremiumModalOpen(true);
                      } else {
                        setIsPremium(false);
                      }
                    }}
                    className={cn(
                      'flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isPremium
                        ? 'border-secondary/35 bg-secondary/10 text-secondary'
                        : 'border-border bg-muted/25 text-muted-foreground hover:border-secondary/25 hover:bg-secondary/[0.06] hover:text-secondary',
                    )}
                  >
                    <Crown className="size-5" aria-hidden="true" />
                    <span>{isPremium ? `${premiumPrice} coins` : 'Premium'}</span>
                  </button>
                )}

                <button
                  type="button"
                  aria-pressed={hasTipsEnabled}
                  onClick={() => setHasTipsEnabled(!hasTipsEnabled)}
                  className={cn(
                    'flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    hasTipsEnabled
                      ? 'border-success/35 bg-success/10 text-success'
                      : 'border-border bg-muted/25 text-muted-foreground hover:border-success/25 hover:bg-success/[0.06] hover:text-success',
                  )}
                >
                  <Coins className="size-5" aria-hidden="true" />
                  <span>{hasTipsEnabled ? 'Tips on' : 'Tips off'}</span>
                </button>
              </div>

              <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || (!headline.trim() && (!editor || editor.isEmpty) && !coverImage)}
                  className="h-12 w-full rounded-2xl text-sm font-semibold shadow-sm"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <SerkleLoader size="xs" className="text-primary-foreground" />
                      Publishing…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Publish post
                      <Send className="size-4" aria-hidden="true" />
                    </span>
                  )}
                </Button>
                <div className="mt-2.5 flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
                  <span>Visible to Circle members</span>
                  <span>Rich text enabled</span>
                </div>
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
                const excerpt = locked ? null : circlePostExcerpt(post.content ?? '');
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
                      {(canModerate || currentUser?.id === post.user_id) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label="Post options">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canModerate && <DropdownMenuItem onClick={() => handleTogglePin(post)}>
                              {post.pinned_at ? <PinOff className="mr-2 size-4" /> : <Pin className="mr-2 size-4" />}
                              {post.pinned_at ? 'Unpin Post' : 'Pin to Top'}
                            </DropdownMenuItem>}
                            {currentUser?.id === post.user_id && <DropdownMenuItem onClick={() => {
                              setSelectedPostForEdit(post);
                              setIsEditModalOpen(true);
                            }}>
                              <Pencil className="mr-2 size-4" /> Edit Post
                            </DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => handleDeletePost(post.id)} className="text-destructive">
                              <Trash2 className="mr-2 size-4" /> Delete Post
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </header>

                    {post.pinned_at && <span className="inline-flex items-center gap-1 self-start text-xs font-semibold text-primary"><Pin className="size-3" />Pinned</span>}

                    <div className="min-w-0">
                      <h3 dir="auto" className="break-words text-lg font-bold leading-tight tracking-tight">
                        <Link to={detailPath} className="rounded-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                          {post.headline || (locked ? 'Premium post' : circle.name + '’s post')}
                        </Link>
                      </h3>
                      {excerpt && <p className="mt-1 line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">{excerpt}</p>}
                    </div>

                    {locked ? (
                      <>
                        {post.previewImage && (
                          <Link to={detailPath} aria-label="Open premium post preview" className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                            <CirclePreviewImage src={post.previewImage} />
                          </Link>
                        )}
                        {(hasActiveSubscription || isOwner) ? (
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                            <span>{isOwner ? 'Author access syncing...' : 'Subscriber access syncing...'}</span>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => retryPosts()}>
                              Refresh
                            </Button>
                          </div>
                        ) : (
                          <div className="grid gap-2">
                            {post.premium_price != null && post.premium_price > 0 && (
                              <Button className="min-h-11 rounded-xl" onClick={() => setUnlockTargetPost(post)}>
                                Unlock for {post.premium_price} coins
                              </Button>
                            )}
                            {circle.subscription_enabled && (
                              <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setSubscribeModalOpen(true)}>
                                {circle.subscription_price ? `Subscribe (${circle.subscription_price} coins/mo) · Unlock all` : 'Subscribe · Unlock all posts'}
                              </Button>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {cover && <OptimizedImage src={cover} alt="Post cover" className="w-full rounded-xl" imageClassName="object-contain" style={{ aspectRatio: '16 / 10' }} onOpen={() => navigate(detailPath)} openLabel="Open post" />}
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
                          <Link to={detailPath} state={{ openComments: true }} className="engagement-btn">
                            <MessageCircle aria-hidden="true" strokeWidth={1.85} className="engagement-icon" />
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

      <Dialog open={!!unlockTargetPost} onOpenChange={(open) => { if (!open && !isUnlockingPost) setUnlockTargetPost(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="size-5 text-primary" />
              Unlock premium post
            </DialogTitle>
            <DialogDescription>
              {circle?.subscription_enabled
                ? 'Pay once with coins for this post, or subscribe to read all posts in this circle for free.'
                : 'Pay once with coins to unlock full access to this post.'}
            </DialogDescription>
          </DialogHeader>
          {unlockTargetPost && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-border bg-accent/40 p-3 text-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Post price</span>
                  <span className="font-semibold">{unlockTargetPost.premium_price} coins</span>
                </div>
                {currentUser && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Your balance</span>
                    <span className={wallet !== undefined && wallet.balance < unlockTargetPost.premium_price ? 'text-destructive font-medium' : ''}>
                      {(wallet?.balance ?? 0).toLocaleString()} coins
                    </span>
                  </div>
                )}
              </div>
              {currentUser && wallet !== undefined && wallet.balance < unlockTargetPost.premium_price && (
                <p className="text-xs text-destructive">Insufficient coins. Top up your wallet to unlock.</p>
              )}
              <div className="grid gap-2">
                <Button
                  className="min-h-11 rounded-xl"
                  disabled={isUnlockingPost || (!!currentUser && wallet !== undefined && wallet.balance < unlockTargetPost.premium_price)}
                  onClick={() => handleUnlockPostWithCoins(unlockTargetPost)}
                >
                  {isUnlockingPost ? <SerkleLoader size="xs" /> : `Pay ${unlockTargetPost.premium_price} coins to unlock`}
                </Button>
                {circle?.subscription_enabled && !hasActiveSubscription && (
                  <Button
                    variant="outline"
                    className="min-h-11 rounded-xl"
                    disabled={isUnlockingPost}
                    onClick={() => {
                      setUnlockTargetPost(null);
                      setSubscribeModalOpen(true);
                    }}
                  >
                    {circle.subscription_price
                      ? `Subscribe (${circle.subscription_price} coins/mo) · All posts free`
                      : 'Subscribe · Unlock all posts'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SubscribeCircleModal
        isOpen={subscribeModalOpen}
        onClose={() => setSubscribeModalOpen(false)}
        circleId={circleId || ''}
        circleName={circle?.name || 'this circle'}
        subscriptionPrice={circle?.subscription_price}
        onSubscribed={async () => {
          await refreshCircleAccessQueries(queryClient, { circleId });
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
