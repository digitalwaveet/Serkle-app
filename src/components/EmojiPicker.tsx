import React, { useState } from 'react';
import { Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useNavigation } from '@/contexts/NavigationContext';

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    icon: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥'],
  },
  {
    name: 'Emotions',
    icon: '❤️',
    emojis: ['😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞'],
  },
  {
    name: 'Gestures',
    icon: '👋',
    emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪', '🦾', '🖕', '✍️', '🤳', '💅'],
  },
  {
    name: 'Hearts',
    icon: '💖',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '🫶', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '🗯️', '💭', '💤'],
  },
  {
    name: 'Fun',
    icon: '🎉',
    emojis: ['🎉', '🎊', '🎈', '🎁', '🎀', '🎗️', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🎯', '🎮', '🎲', '🎭', '🎨', '🎬', '🎤', '🎧', '🎵', '🎶', '🎸', '🥁', '🎺', '🎻', '🎹', '🪘', '🔥', '⭐', '🌟', '✨', '💫', '🌈', '☀️', '🌙'],
  },
  {
    name: 'Food',
    icon: '🍕',
    emojis: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧈', '🥞', '🧇', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '☕', '🍵', '🧃', '🥤', '🧋', '🍺', '🍻', '🥂', '🍷', '🍸', '🍹', '🧉', '🍾', '🫖'],
  },
  {
    name: 'Animals',
    icon: '🐱',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋'],
  },
  {
    name: 'Nature',
    icon: '🌸',
    emojis: ['🌸', '💐', '🌷', '🌹', '🥀', '🌺', '🌻', '🌼', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🍀', '☘️', '🍁', '🍂', '🍃', '🌾', '🌿', '🍄', '🪸', '🪹', '🪺'],
  },
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  variant?: 'default' | 'compact';
  className?: string;
  triggerClassName?: string;
  /** Notifies the parent when the picker opens/closes (used to pause story playback). */
  onOpenChange?: (open: boolean) => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onEmojiSelect,
  variant = 'default',
  className,
  triggerClassName,
  onOpenChange,
}) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [open, setOpen] = useState(false);
  const { pushModalState } = useNavigation();

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange?.(isOpen);
    if (isOpen) {
      pushModalState('emoji-picker', () => setOpen(false));
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleSelect = (emoji: string) => {
    onEmojiSelect(emoji);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex-shrink-0",
            triggerClassName
          )}
          aria-label="Add emoji"
        >
          <Smile className={cn("size-5", variant === 'compact' && "size-4")} />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="start" 
        className={cn("w-[320px] p-0 rounded-2xl shadow-xl border border-border", className)}
        sideOffset={8}
      >
        {/* Category tabs */}
        <div className="flex gap-0.5 px-2 pt-2 pb-1 border-b border-border overflow-x-auto scrollbar-hide">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(i)}
              className={cn(
                "p-1.5 rounded-lg text-lg transition-colors flex-shrink-0",
                activeCategory === i 
                  ? "bg-primary/10" 
                  : "hover:bg-muted"
              )}
              title={cat.name}
            >
              {cat.icon}
            </button>
          ))}
        </div>

        {/* Emoji grid */}
        <div className="h-[200px] overflow-y-auto px-2 py-2">
          <p className="text-xs text-muted-foreground font-medium mb-1.5 px-1">
            {EMOJI_CATEGORIES[activeCategory].name}
          </p>
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelect(emoji)}
                className="p-1.5 text-xl rounded-lg hover:bg-muted transition-colors active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
