import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFriendsList } from '@/hooks/useCircleInvitations';
import { useUser } from '@/contexts/UserContext';
import { cn } from '@/lib/utils';

interface MentionFriend {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  initials: string;
  avatar_color: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  autoFocus?: boolean;
  dir?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

const MentionTextarea: React.FC<MentionTextareaProps> = ({
  value,
  onChange,
  placeholder,
  className,
  rows = 1,
  autoFocus,
  dir,
  onKeyDown,
  textareaRef: externalRef,
}) => {
  const { user } = useUser();
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRefUsed = externalRef || internalRef;
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const { data: friends = [] } = useFriendsList(
    mentionQuery !== null ? user?.id : undefined,
    mentionQuery || ''
  );

  // Detect @ trigger
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal);

    const cursor = e.target.selectionStart || 0;
    // Look backward from cursor for @
    const textBefore = newVal.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStart(cursor - atMatch[0].length);
      setSelectedIdx(0);

      // Position dropdown near textarea
      const ta = textareaRefUsed.current;
      if (ta) {
        const rect = ta.getBoundingClientRect();
        setDropdownPos({
          top: rect.height + 4,
          left: 0,
        });
      }
    } else {
      setMentionQuery(null);
    }
  }, [onChange, textareaRefUsed]);

  const insertMention = useCallback((friend: MentionFriend) => {
    const before = value.slice(0, mentionStart);
    const cursor = textareaRefUsed.current?.selectionStart || value.length;
    const after = value.slice(cursor);
    const mention = `@${friend.username} `;
    const newVal = before + mention + after;
    onChange(newVal);
    setMentionQuery(null);

    // Set cursor after the mention
    requestAnimationFrame(() => {
      const ta = textareaRefUsed.current;
      if (ta) {
        const pos = before.length + mention.length;
        ta.selectionStart = pos;
        ta.selectionEnd = pos;
        ta.focus();
      }
    });
  }, [value, mentionStart, onChange, textareaRefUsed]);

  const handleKeyDownInternal = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && friends.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(prev => (prev + 1) % friends.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(prev => (prev - 1 + friends.length) % friends.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(friends[selectedIdx] as MentionFriend);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  }, [mentionQuery, friends, selectedIdx, insertMention, onKeyDown]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMentionQuery(null);
      }
    };
    if (mentionQuery !== null) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [mentionQuery]);

  const showDropdown = mentionQuery !== null && friends.length > 0;

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRefUsed as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDownInternal}
        placeholder={placeholder}
        className={className}
        rows={rows}
        autoFocus={autoFocus}
        dir={dir}
      />
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-[100] w-full max-h-[180px] overflow-y-auto bg-popover border border-border rounded-xl shadow-lg"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {friends.map((friend: MentionFriend, idx: number) => (
            <button
              key={friend.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(friend);
              }}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors',
                idx === selectedIdx ? 'bg-accent' : 'hover:bg-muted'
              )}
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={friend.avatar_url || undefined} />
                <AvatarFallback
                  className="text-[10px]"
                  style={{ backgroundColor: friend.avatar_color }}
                >
                  {friend.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{friend.name}</p>
                <p className="text-xs text-muted-foreground truncate">@{friend.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionTextarea;
