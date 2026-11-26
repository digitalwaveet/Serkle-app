import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Link2, Send, Download, X, Check, BookImage, Share2 } from 'lucide-react';
import { VideoLoader } from '@/components/ui/VideoLoader';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useCreateConversation } from '@/hooks/useConversations';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import StoryEditor from '@/components/story/StoryEditor';
import { storyService } from '@/services/storyService';
import {
  buildVideoShareUrl,
  copyTextToClipboard,
  formatVideoShareMessage,
  shareViaNativeSheet,
} from '@/lib/videoShare';

const PUBLISHED_URL = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');

interface VideoShareMenuProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoUrl: string;
  videoTitle?: string | null;
  onShareConfirmed?: () => Promise<void> | void;
}

interface Follower {
  id: string;
  name: string;
  username: string;
  initials: string;
  avatar_url: string | null;
  avatar_color: string;
}

export const VideoShareMenu: React.FC<VideoShareMenuProps> = ({
  isOpen,
  onClose,
  videoId,
  videoUrl,
  videoTitle,
  onShareConfirmed,
}) => {
  const { user } = useUser();
  const { createConversation } = useCreateConversation();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [sharingNative, setSharingNative] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStoryEditor, setShowStoryEditor] = useState(false);
  const [uploadingStory, setUploadingStory] = useState(false);

  const videoLink = buildVideoShareUrl(videoId, PUBLISHED_URL);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (isOpen && showFriends && user) {
      void fetchFollowers();
    }
  }, [isOpen, showFriends, user]);

  useEffect(() => {
    if (!isOpen) {
      setShowFriends(false);
      setSentTo(new Set());
      setSendingTo(null);
      setCopied(false);
      setShowStoryEditor(false);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showStoryEditor) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, showStoryEditor]);

  const fetchFollowers = async () => {
    if (!user) return;
    setLoadingFriends(true);
    try {
      const [followingRes, followersRes] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('follows').select('follower_id').eq('following_id', user.id),
      ]);

      const ids = new Set<string>();
      followingRes.data?.forEach((f) => { if (f.following_id) ids.add(f.following_id); });
      followersRes.data?.forEach((f) => { if (f.follower_id) ids.add(f.follower_id); });
      ids.delete(user.id);

      if (ids.size === 0) {
        setFollowers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, initials, avatar_url, avatar_color')
        .in('id', [...ids])
        .limit(50);

      setFollowers((profiles as Follower[]) || []);
    } catch (error) {
      console.error('Error loading share recipients:', error);
      setFollowers([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyTextToClipboard(videoLink);
    if (!ok) {
      toast({ title: 'Failed to copy link', variant: 'destructive' });
      return;
    }
    setCopied(true);
    toast({ title: 'Link copied!', description: 'Video link copied to clipboard.' });
    await onShareConfirmed?.();
    setTimeout(() => onClose(), 300);
  };

  const handleShareToFriend = async (friendId: string) => {
    if (!user || sendingTo || sentTo.has(friendId)) return;
    setSendingTo(friendId);
    try {
      const conversationId = await createConversation(user.id, friendId);
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: formatVideoShareMessage(videoLink, videoTitle),
      });
      if (error) throw error;

      setSentTo((prev) => new Set(prev).add(friendId));
      toast({ title: 'Sent!', description: `Video shared with ${followers.find(f => f.id === friendId)?.name}` });
      await onShareConfirmed?.();
    } catch (error) {
      console.error('Error sharing video to friend:', error);
      toast({ title: 'Failed to send', variant: 'destructive' });
    } finally {
      setSendingTo(null);
    }
  };

  const handleNativeShare = async () => {
    if (sharingNative) return;
    setSharingNative(true);
    try {
      const outcome = await shareViaNativeSheet({
        title: videoTitle?.trim() || 'Video on Serkle',
        url: videoLink,
      });
      if (outcome === 'shared') {
        await onShareConfirmed?.();
        onClose();
      } else if (outcome === 'error') {
        toast({ title: 'Could not share video', variant: 'destructive' });
      }
    } finally {
      setSharingNative(false);
    }
  };

  const handleSaveVideo = async () => {
    setSaving(true);
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Serkle_${videoId.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Video downloaded!', description: 'Downloaded to your device.' });
      onClose();
    } catch {
      toast({ title: 'Failed to download video', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleShareToStory = () => {
    if (!user) {
      toast({ title: 'Please log in', description: 'You must be logged in to share a story.', variant: 'destructive' });
      return;
    }
    setShowStoryEditor(true);
  };

  if (!isOpen) return null;

  // Show story editor full-screen when selected
  if (showStoryEditor) {
    const storyEditorNode = (
      <>
        <StoryEditor
          previewUrl={videoUrl}
          mediaType="video"
          onCancel={() => setShowStoryEditor(false)}
          onDone={async (editedBlob, mentionedUserIds, extraData) => {
            if (!user) {
              toast({ title: 'Please log in', description: 'You must be logged in to share a story.', variant: 'destructive' });
              return;
            }

            setUploadingStory(true);
            try {
              const isVideo = extraData?.mediaType === 'video' && extraData?.originalVideoUrl;
              await storyService.createStory(user.id, editedBlob, isVideo, mentionedUserIds, {
                ...extraData,
              });

              await onShareConfirmed?.();
              toast({ title: 'Shared to story!', description: 'Video has been added to your story.' });
              setShowStoryEditor(false);
              onClose();
            } catch (error) {
              console.error('Story upload error:', error);
              toast({ title: 'Failed to share', description: 'Please try again.', variant: 'destructive' });
            } finally {
              setUploadingStory(false);
            }
          }}
        />
        {uploadingStory && (
          <VideoLoader fullscreen dark size="lg" label="Sharing to story..." />
        )}
      </>
    );

    return typeof document !== 'undefined' ? createPortal(storyEditorNode, document.body) : storyEditorNode;
  }

  const sheetNode = (
    <div
      className="fixed inset-0 z-[100]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-share-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl animate-in slide-in-from-bottom duration-300 max-h-[75vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-4 pb-2 flex items-center justify-between">
          <h3 id="video-share-title" className="text-lg font-semibold text-foreground">Share</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share sheet"
            className="p-1 rounded-full hover:bg-muted"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Friend list (shown when Share to Friend is tapped) */}
        {showFriends && (
          <div className="px-4 pb-3">
            {!user ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Log in to share videos with friends
              </p>
            ) : loadingFriends ? (
              <div className="flex justify-center py-4">
                <SerkleLoader size="xs" label="Loading friends" />
              </div>
            ) : followers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Follow people to share videos directly in chat
              </p>
            ) : (
              <div className="flex gap-4 overflow-x-auto py-2 scrollbar-hide">
                {followers.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => handleShareToFriend(f.id)}
                    disabled={sendingTo === f.id || sentTo.has(f.id)}
                    className="flex flex-col items-center gap-1.5 min-w-[64px] disabled:opacity-75"
                  >
                    <div className="relative">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-semibold text-white overflow-hidden border-2 border-border"
                        style={{ backgroundColor: f.avatar_color }}
                      >
                        {f.avatar_url ? (
                          <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover" />
                        ) : (
                          f.initials
                        )}
                      </div>
                      {sentTo.has(f.id) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-foreground truncate w-16 text-center">
                      {f.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action rows */}
        <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-1">
          {/* Share to Story */}
          <button
            type="button"
            onClick={handleShareToStory}
            className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <BookImage className="w-5 h-5 text-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">Share to Story</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              {copied ? <Check className="w-5 h-5 text-green-600" /> : <Link2 className="w-5 h-5 text-foreground" />}
            </div>
            <span className="text-sm font-medium text-foreground">{copied ? 'Copied' : 'Copy Link'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFriends(!showFriends)}
            className={cn(
              "flex items-center gap-4 w-full p-3 rounded-xl hover:bg-muted transition-colors",
              showFriends && "bg-muted"
            )}
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Send className="w-5 h-5 text-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">Share to Friend</span>
          </button>

          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              disabled={sharingNative}
              className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-muted transition-colors disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Share2 className="w-5 h-5 text-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">More apps</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveVideo}
            disabled={saving}
            className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-muted transition-colors disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              {saving ? <SerkleLoader size="xs" label="Downloading video" /> : <Download className="w-5 h-5 text-foreground" />}
            </div>
            <span className="text-sm font-medium text-foreground">
              {saving ? 'Downloading...' : 'Download Video'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(sheetNode, document.body) : sheetNode;
};
