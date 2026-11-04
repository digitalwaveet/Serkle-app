import React, { useState, useEffect } from 'react';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Link2, Send, Download, X, Check, BookImage } from 'lucide-react';
import { VideoLoader } from '@/components/ui/VideoLoader';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useCreateConversation } from '@/hooks/useConversations';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import StoryEditor from '@/components/story/StoryEditor';
import { storyService } from '@/services/storyService';

const PUBLISHED_URL = import.meta.env.VITE_APP_URL || window.location.origin;

interface VideoShareMenuProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoUrl: string;
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
}) => {
  const { user } = useUser();
  const { createConversation } = useCreateConversation();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [showFriends, setShowFriends] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showStoryEditor, setShowStoryEditor] = useState(false);
  const [uploadingStory, setUploadingStory] = useState(false);

  const videoLink = `${PUBLISHED_URL}/video/${videoId}`;

  useEffect(() => {
    if (isOpen && showFriends && user) {
      fetchFollowers();
    }
  }, [isOpen, showFriends, user]);

  useEffect(() => {
    if (!isOpen) {
      setShowFriends(false);
      setSentTo(new Set());
      setShowStoryEditor(false);
    }
  }, [isOpen]);

  const fetchFollowers = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    if (error || !data) return;

    const followingIds = data.map((f) => f.following_id);
    if (followingIds.length === 0) {
      setFollowers([]);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, username, initials, avatar_url, avatar_color')
      .in('id', followingIds);

    setFollowers((profiles as Follower[]) || []);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(videoLink);
      toast({ title: 'Link copied!', description: 'Video link copied to clipboard.' });
      onClose();
    } catch {
      toast({ title: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const handleShareToFriend = async (friendId: string) => {
    if (!user || sendingTo) return;
    setSendingTo(friendId);
    try {
      const conversationId = await createConversation(user.id, friendId);
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: `Check out this video! ${videoLink}`,
      });
      setSentTo((prev) => new Set(prev).add(friendId));
      toast({ title: 'Sent!', description: `Video shared with ${followers.find(f => f.id === friendId)?.name}` });
    } catch {
      toast({ title: 'Failed to send', variant: 'destructive' });
    } finally {
      setSendingTo(null);
    }
  };

  const handleSaveVideo = async () => {
    setSaving(true);
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HeartLens_${videoId.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Video saved!', description: 'Downloaded to your device.' });
      onClose();
    } catch {
      toast({ title: 'Failed to save video', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleShareToStory = () => {
    setShowStoryEditor(true);
  };

  if (!isOpen) return null;

  // Show story editor full-screen when selected
  if (showStoryEditor) {
    return (
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
  }

  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl animate-in slide-in-from-bottom duration-300 max-h-[70vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-4 pb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Share</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Friend list (shown when Share to Friend is tapped) */}
        {showFriends && (
          <div className="px-4 pb-3">
            {followers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                You're not following anyone yet
              </p>
            ) : (
              <div className="flex gap-4 overflow-x-auto py-2 scrollbar-hide">
                {followers.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleShareToFriend(f.id)}
                    disabled={sendingTo === f.id || sentTo.has(f.id)}
                    className="flex flex-col items-center gap-1.5 min-w-[64px]"
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
        <div className="px-4 pb-6 space-y-1">
          {/* Share to Story */}
          <button
            onClick={handleShareToStory}
            className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <BookImage className="w-5 h-5 text-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">Share to Story</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Link2 className="w-5 h-5 text-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">Copy Link</span>
          </button>

          <button
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

          <button
            onClick={handleSaveVideo}
            disabled={saving}
            className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              {saving ? <SerkleLoader size="xs" label="Saving video" /> : <Download className="w-5 h-5 text-foreground" />}
            </div>
            <span className="text-sm font-medium text-foreground">
              {saving ? 'Saving...' : 'Save Video'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
