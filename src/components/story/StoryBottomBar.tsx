import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useRef } from 'react';
import { Heart, Send, BarChart3, Repeat2, ChevronUp } from 'lucide-react';
import EmojiPicker from '@/components/EmojiPicker';
import { StoryMention, PauseReason } from '@/types/storyTypes';
import { toast } from '@/hooks/use-toast';

interface StoryBottomBarProps {
  isOwnStory: boolean;
  storyDbId: string | null;
  isLiked: boolean;
  isLikeLoading: boolean;
  onLikeToggle: () => void;
  isResharing: boolean;
  isMentionedInStory: boolean;
  onReshare: () => void;
  onSendMessage: (msg: string) => Promise<void>;
  onShowActivity: () => void;
  onShare: () => void;
  onPause: (reason: PauseReason) => void;
  onResume: (reason: PauseReason) => void;
  storyMentions: StoryMention[];
  onMentionClick: (userId: string) => void;
}

export const StoryBottomBar: React.FC<StoryBottomBarProps> = ({
  isOwnStory,
  storyDbId,
  isLiked,
  isLikeLoading,
  onLikeToggle,
  isResharing,
  isMentionedInStory,
  onReshare,
  onSendMessage,
  onShowActivity,
  onShare,
  onPause,
  onResume,
  storyMentions,
  onMentionClick,
}) => {
  const [message, setMessage] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);

  // The reply box is "engaged" while the user is focused on it, the emoji picker
  // is open, or there's a draft message. Playback stays paused for that whole
  // window — so transient blurs (opening the emoji picker, the keyboard hiding)
  // don't resume the story. Once everything clears (e.g. after sending), we resume.
  const replyEngaged = inputFocused || emojiOpen || message.trim().length > 0;

  useEffect(() => {
    if (replyEngaged) {
      onPause('input');
      return;
    }
    // Debounce so flipping focus → emoji picker doesn't briefly resume in between.
    const t = setTimeout(() => onResume('input'), 120);
    return () => clearTimeout(t);
  }, [replyEngaged, onPause, onResume]);

  // Safety: always release the input pause if the bar unmounts (e.g. viewer closed).
  useEffect(() => {
    return () => onResume('input');
  }, [onResume]);

  const handleSendMessage = async () => {
    if (!message.trim() || sendingRef.current) return;
    sendingRef.current = true; setSending(true);
    try {
      await onSendMessage(message.trim());
      setMessage('');
      setInputFocused(false);
      setEmojiOpen(false);
      inputRef.current?.blur();
    } catch {
      toast({ title: 'Reply not saved', description: 'Your reply is still here. Please try again.', variant: 'destructive' });
    } finally { sendingRef.current = false; setSending(false); }
  };

  return (
    <>
      {/* Mentions Tags */}
      <div className="absolute bottom-20 left-3 right-3 z-10">
        {storyMentions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {storyMentions.map(mention => (
              <button
                key={mention.user_id}
                onClick={(e) => {
                  e.stopPropagation();
                  onMentionClick(mention.user_id);
                }}
                className="story-mention-tag"
                data-story-controls
              >
                @{mention.username}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Bottom Bar */}
      {!isOwnStory ? (
        <div className="story-viewer-bottom absolute left-3 right-3 z-[50] flex items-center gap-2" data-story-controls>
          {/* Reply input — primary, left (Instagram pattern) */}
          <div className="story-message-input flex-1">
            <EmojiPicker
              onEmojiSelect={(emoji) => setMessage(prev => prev + emoji)}
              onOpenChange={setEmojiOpen}
              variant="compact"
              triggerClassName="text-white/60 hover:text-white hover:bg-white/10"
              className="z-[200]"
            />
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Send message"
              aria-label="Reply to this story"
              maxLength={2000}
              disabled={sending}
              className="min-w-0 flex-1 bg-transparent text-white placeholder:text-white/60 outline-none text-sm"
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            {message && (
              <button
                onClick={handleSendMessage}
                disabled={sending}
                className="text-white hover:text-white/80 transition-colors shrink-0 px-2"
                aria-label="Send message"
              >
                {sending ? <SerkleLoader size="xs" /> : <Send className="size-5" />}
              </button>
            )}
          </div>

          {/* Reshare button (only when mentioned) */}
          {isMentionedInStory && (
            <button
              onClick={onReshare}
              disabled={isResharing}
              className="story-action-btn shrink-0"
              aria-label="Reshare to your story"
            >
              {isResharing ? (
                <SerkleLoader size="xs" className="text-white" />
              ) : (
                <Repeat2 className="size-5 text-white" />
              )}
            </button>
          )}

          {/* Like button — right */}
          <button
            onClick={onLikeToggle}
            disabled={isLikeLoading}
            aria-pressed={isLiked}
            className="story-action-btn shrink-0"
            aria-label={isLiked ? "Unlike story" : "Like story"}
          >
            <Heart
              className={`size-6 transition-all duration-200 ${
                isLiked
                  ? 'fill-red-500 text-red-500 story-heart-pop'
                  : 'text-white'
              }`}
            />
          </button>

          {/* Share button — right */}
          <button
            onClick={onShare}
            className="story-action-btn shrink-0"
            aria-label="Share author profile"
          >
            <Send className="size-5 text-white" />
          </button>
        </div>
      ) : (
        /* Activity button - only for story owner */
        storyDbId && (
          <div className="story-viewer-bottom absolute left-4 right-4 z-[50] flex justify-start" data-story-controls>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowActivity();
              }}
              className="story-activity-btn"
            >
              <BarChart3 className="size-4" />
              <span className="text-sm font-medium">Activity</span>
            </button>
          </div>
        )
      )}
    </>
  );
};
