import React from 'react';
import { cn } from '@/lib/utils';
import { GiftCommentMetadata } from '@/lib/giftComment';
import { DiamondVectorGraphic } from './MiniGiftAnimation';

interface GiftCommentCardProps {
  metadata: GiftCommentMetadata;
  className?: string;
}

export const GiftCommentCard: React.FC<GiftCommentCardProps> = ({
  metadata,
  className,
}) => {
  const isDiamond =
    metadata.giftId.toLowerCase() === 'diamond' ||
    metadata.name.toLowerCase() === 'diamond' ||
    metadata.emoji === '💎';

  const heading =
    metadata.quantity > 1
      ? `Sent ${metadata.quantity}× ${metadata.name}`
      : `Sent a ${metadata.name}`;

  return (
    <div
      data-gift-id={metadata.giftId}
      data-gift-name={metadata.name}
      data-gift-quantity={metadata.quantity}
      data-gift-value={metadata.value}
      data-gift-sender-id={metadata.senderId}
      data-gift-transaction-id={metadata.transactionId}
      className={cn(
        'my-1.5 inline-flex max-w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 shadow-sm transition-all',
        isDiamond
          ? 'border-[#53D7FF]/35 bg-gradient-to-r from-[#53D7FF]/12 via-[#7864EA]/12 to-transparent'
          : 'border-[#7864EA]/25 bg-gradient-to-r from-[#7864EA]/10 via-primary/5 to-transparent',
        className
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl border',
          isDiamond
            ? 'border-[#53D7FF]/40 bg-[#53D7FF]/15 shadow-[0_0_12px_rgba(83,215,255,0.25)]'
            : 'border-[#7864EA]/30 bg-[#7864EA]/10'
        )}
      >
        {metadata.image ? (
          <img
            src={metadata.image}
            alt={metadata.name}
            className="size-7 object-contain select-none"
          />
        ) : isDiamond ? (
          <DiamondVectorGraphic className="size-7" />
        ) : (
          <span className="text-2xl leading-none select-none" aria-hidden="true">
            {metadata.emoji}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-foreground truncate">
            {metadata.emoji} {heading}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
              isDiamond
                ? 'bg-[#53D7FF]/15 text-[#0891B2] dark:text-[#53D7FF]'
                : 'bg-[#7864EA]/15 text-[#7864EA]'
            )}
          >
            {metadata.value.toLocaleString()} coins
          </span>
        </div>
      </div>
    </div>
  );
};

export default GiftCommentCard;

