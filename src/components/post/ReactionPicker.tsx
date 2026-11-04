import React from 'react';
import { cn } from '@/lib/utils';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

const REACTIONS = [
  { label: 'like', emoji: '❤️' },
  { label: 'love', emoji: '👍' },
  { label: 'haha', emoji: '😂' },
  { label: 'wow', emoji: '😮' },
  { label: 'sad', emoji: '😢' },
  { label: 'angry', emoji: '😡' },
];

const ReactionPicker: React.FC<ReactionPickerProps> = ({ onSelect, onClose, className }) => {
  return (
    <div 
      className={cn(
        "flex items-center gap-1 p-1.5 bg-background/80 backdrop-blur-xl border border-border/50 rounded-full shadow-2xl animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200 z-50",
        className
      )}
      onMouseLeave={onClose}
    >
      {REACTIONS.map((reac) => (
        <button
          key={reac.label}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(reac.label);
            onClose();
          }}
          className="p-2.5 text-2xl hover:scale-125 transition-transform duration-200 active:scale-95 flex items-center justify-center rounded-full hover:bg-muted/50"
          title={reac.label}
        >
          {reac.emoji}
        </button>
      ))}
    </div>
  );
};

export default ReactionPicker;
