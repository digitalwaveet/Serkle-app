import React from 'react';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '👏'];

interface ReactionBarProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const ReactionBar: React.FC<ReactionBarProps> = ({ isOpen, position, onSelect, onClose }) => {
  if (!isOpen) return null;

  const barWidth = 280;
  let left = position.x - barWidth / 2;
  let top = position.y - 56;
  if (left < 8) left = 8;
  if (left + barWidth > window.innerWidth - 8) left = window.innerWidth - barWidth - 8;
  if (top < 8) top = position.y + 8;

  return (
    <div className="fixed inset-0 z-[85] bg-black/10" onClick={onClose}>
      <div
        className="absolute bg-popover border border-border rounded-full shadow-xl px-2 py-1.5 flex items-center gap-1 animate-scale-in"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="text-xl w-10 h-10 rounded-full hover:bg-muted/60 flex items-center justify-center active:scale-125 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ReactionBar;
