import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import EmojiPicker from '@/components/EmojiPicker';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUser } from '@/contexts/UserContext';
import { GiftEmojiPicker, GiftEmoji } from '@/components/GiftEmojiPicker';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import MentionTextarea from '@/components/MentionTextarea';

interface PersistentCommentComposerProps {
  onSubmit: (comment: string) => void;
  onGiftSend?: (gift: GiftEmoji) => void;
  placeholder?: string;
  displayName?: string;
  displayAvatar?: string;
  displayColor?: string;
  recipientId?: string;
  recipientName?: string;
}

export const PersistentCommentComposer: React.FC<PersistentCommentComposerProps> = ({
  onSubmit,
  onGiftSend,
  placeholder = "Add a comment...",
  displayName,
  displayAvatar,
  displayColor,
  recipientId,
  recipientName
}) => {
  const [comment, setComment] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useUser();

  const avatarText = displayName || user?.initials || 'U';
  const avatarColor = displayColor || user?.avatarColor || '#E08ED1';
  const avatarImg = displayAvatar || user?.avatar;

  // Auto-expand textarea up to 4 lines
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const lineHeight = 24; // Approximate line height
    const maxHeight = lineHeight * 4; // 4 lines max
    
    if (scrollHeight > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = `${scrollHeight}px`;
      textarea.style.overflowY = 'hidden';
    }
  }, [comment]);

  const handleSubmit = () => {
    if (comment.trim()) {
      onSubmit(comment.trim());
      setComment('');
      textareaRef.current?.blur();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Safe area padding for mobile devices */}
      <div className="pb-safe">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 bg-background p-2 shadow-lg rounded-full border border-border">
              {/* User profile */}
              <div 
                className="size-9 rounded-full grid place-items-center text-xs font-medium text-white overflow-hidden flex-shrink-0"
                style={{ backgroundColor: avatarColor }}
              >
                {avatarImg ? (
                  <img src={avatarImg} alt={avatarText} className="w-full h-full object-cover" />
                ) : (
                  avatarText
                )}
              </div>
              
              {/* Comment input */}
              <div className="flex-1 min-w-0">
                <MentionTextarea
                  textareaRef={textareaRef}
                  value={comment}
                  onChange={setComment}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="w-full bg-transparent text-sm placeholder:text-muted-foreground outline-none resize-none min-h-[24px] leading-6"
                  rows={1}
                />
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <EmojiPicker 
                  onEmojiSelect={(emoji) => {
                    setComment(prev => prev + emoji);
                    textareaRef.current?.focus();
                  }}
                  variant="compact"
                />
                {recipientId && (
                  <GiftEmojiPicker
                    onGiftSelect={(gift) => onGiftSend?.(gift)}
                    recipientName={recipientName}
                  />
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!comment.trim()}
                  className={cn(
                    "shrink-0 h-9 w-9 rounded-full flex items-center justify-center active:scale-90 transition-all",
                    comment.trim() 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};