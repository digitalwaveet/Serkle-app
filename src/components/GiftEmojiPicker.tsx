import React, { useState, useRef } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { useNavigation } from '@/contexts/NavigationContext';
import { DiamondVectorGraphic } from '@/components/post/MiniGiftAnimation';

export interface GiftEmoji {
  id: string;
  emoji: string;
  label: string;
  value: number;
  image?: string;
  quantity?: number;
}

export const GIFT_EMOJIS: GiftEmoji[] = [
  { id: 'love', emoji: '❤️', label: 'Love', value: 10, quantity: 1 },
  { id: 'rose', emoji: '🌹', label: 'Rose', value: 25, quantity: 1 },
  { id: 'star', emoji: '⭐', label: 'Star', value: 50, quantity: 1 },
  { id: 'crown', emoji: '👑', label: 'Crown', value: 200, quantity: 1 },
  { id: 'diamond', emoji: '💎', label: 'Diamond', value: 500, quantity: 1 },
  { id: 'celebration', emoji: '🎉', label: 'Celebration', value: 1000, quantity: 1 },
];

interface GiftEmojiPickerProps {
  onGiftSelect: (gift: GiftEmoji) => void | Promise<void>;
  disabled?: boolean;
  isSending?: boolean;
  recipientId?: string;
  recipientName?: string;
}

export const GiftEmojiPicker: React.FC<GiftEmojiPickerProps> = ({
  onGiftSelect,
  disabled,
  isSending = false,
  recipientId,
  recipientName,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftEmoji>(
    GIFT_EMOJIS.find((g) => g.id === 'diamond') || GIFT_EMOJIS[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const { user } = useUser();
  const { wallet } = useCoinWallet(user?.id);
  const { pushModalState } = useNavigation();

  const balance = wallet?.balance ?? 0;
  const isOwnPost = Boolean(user?.id && recipientId && user.id === recipientId);
  const isBusy = Boolean(disabled || isSending || submitting);
  const canAffordSelected = balance >= selectedGift.value;

  const handleOpenChange = (isOpen: boolean) => {
    if (isBusy && isOpen) return;
    if (isOpen) {
      pushModalState('gift-picker', () => setOpen(false));
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleTileClick = (gift: GiftEmoji) => {
    setSelectedGift(gift);
    if (balance < gift.value) {
      toast.error(`Not enough coins. You need ${gift.value} coins but have ${balance}.`);
    }
  };

  const handleSendGift = async () => {
    if (submitLockRef.current || isBusy) return;
    if (isOwnPost) {
      toast.error('You cannot send a gift to your own post.');
      return;
    }
    if (balance < selectedGift.value) {
      toast.error(`Not enough coins. You need ${selectedGift.value} coins but have ${balance}.`);
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setOpen(false);
    try {
      await onGiftSelect({ ...selectedGift, quantity: selectedGift.quantity ?? 1 });
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isBusy}
          className="px-2 h-8 text-muted-foreground hover:text-primary"
          aria-label="Send a gift"
        >
          {isBusy ? <Loader2 className="size-4 animate-spin text-primary" /> : <Gift className="size-5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 p-3"
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Send a Gift</p>
            <span className="text-xs text-muted-foreground">
              Balance: <span className="font-medium text-primary">{balance} 🪙</span>
            </span>
          </div>
          {recipientName && (
            <p className="text-xs text-muted-foreground">
              Gift to <span className="font-medium">{recipientName}</span>
            </p>
          )}
          {isOwnPost && (
            <div
              role="alert"
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
            >
              You cannot send a gift to your own post. Open another user&apos;s post to send a gift.
            </div>
          )}
          {!isOwnPost && !canAffordSelected && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium text-destructive"
            >
              Insufficient balance: need {selectedGift.value} 🪙 (you have {balance} 🪙).
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {GIFT_EMOJIS.map((gift) => {
              const canAfford = balance >= gift.value;
              const isSelected = selectedGift.id === gift.id;
              const isDiamond = gift.id === 'diamond';
              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => handleTileClick(gift)}
                  disabled={isBusy}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all",
                    isSelected
                      ? "border-[#53D7FF] bg-[#53D7FF]/10 ring-1 ring-[#53D7FF]/50 shadow-sm"
                      : canAfford
                        ? "border-border hover:border-primary hover:bg-primary/5 cursor-pointer"
                        : "border-border/50 opacity-50"
                  )}
                >
                  {isDiamond ? (
                    <DiamondVectorGraphic className="size-7" />
                  ) : (
                    <span className="text-2xl leading-none">{gift.emoji}</span>
                  )}
                  <span className="text-[10px] font-medium text-foreground">{gift.label}</span>
                  <span className="text-[10px] text-primary font-semibold">{gift.value} 🪙</span>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isBusy || isOwnPost || !canAffordSelected}
            onClick={handleSendGift}
            className={cn(
              "w-full h-9 rounded-xl font-semibold text-xs transition-all",
              selectedGift.id === 'diamond' && canAffordSelected && !isOwnPost
                ? "bg-gradient-to-r from-[#53D7FF] to-[#7864EA] text-white hover:opacity-95 shadow-sm"
                : ""
            )}
          >
            {isBusy ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" />
                Sending Gift...
              </span>
            ) : (
              <span>
                Send Gift · {selectedGift.emoji} {selectedGift.label} ({selectedGift.value} 🪙)
              </span>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
