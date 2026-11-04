import React, { useState } from 'react';
import { Gift } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { useNavigation } from '@/contexts/NavigationContext';

export interface GiftEmoji {
  emoji: string;
  label: string;
  value: number;
}

export const GIFT_EMOJIS: GiftEmoji[] = [
  { emoji: '❤️', label: 'Love', value: 10 },
  { emoji: '🌹', label: 'Rose', value: 25 },
  { emoji: '⭐', label: 'Star', value: 50 },
  { emoji: '💎', label: 'Diamond', value: 100 },
  { emoji: '👑', label: 'Crown', value: 200 },
  { emoji: '🎉', label: 'Celebration', value: 500 },
];

interface GiftEmojiPickerProps {
  onGiftSelect: (gift: GiftEmoji) => void;
  disabled?: boolean;
  recipientId?: string;
  recipientName?: string;
}

export const GiftEmojiPicker: React.FC<GiftEmojiPickerProps> = ({
  onGiftSelect,
  disabled,
  recipientId,
  recipientName,
}) => {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const { wallet } = useCoinWallet(user?.id);
  const { pushModalState } = useNavigation();

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      pushModalState('gift-picker', () => setOpen(false));
      setOpen(true);
    } else {
      setOpen(false);
    }
  };
  const balance = wallet?.balance ?? 0;

  const handleSelect = (gift: GiftEmoji) => {
    if (balance < gift.value) {
      toast.error(`Not enough coins. You need ${gift.value} coins but have ${balance}.`);
      return;
    }
    onGiftSelect(gift);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="px-2 h-8 text-muted-foreground hover:text-primary"
          aria-label="Send a gift"
        >
          <Gift className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 p-3"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-foreground">Send a Gift</p>
            <span className="text-xs text-muted-foreground">
              Balance: <span className="font-medium text-primary">{balance} 🪙</span>
            </span>
          </div>
          {recipientName && (
            <p className="text-xs text-muted-foreground mb-2">
              Gift to <span className="font-medium">{recipientName}</span>
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {GIFT_EMOJIS.map((gift) => {
              const canAfford = balance >= gift.value;
              return (
                <button
                  key={gift.label}
                  onClick={() => handleSelect(gift)}
                  disabled={!canAfford}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all",
                    canAfford
                      ? "border-border hover:border-primary hover:bg-primary/5 cursor-pointer"
                      : "border-border/50 opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className="text-2xl">{gift.emoji}</span>
                  <span className="text-[10px] font-medium text-foreground">{gift.label}</span>
                  <span className="text-[10px] text-primary font-semibold">{gift.value} 🪙</span>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
