import React from 'react';
import { ExternalLink } from 'lucide-react';
import { StoryStickerData, PauseReason } from '@/types/storyTypes';

interface StoryLinkOverlayProps {
  showLinkOverlay: boolean;
  stickerData?: StoryStickerData[];
  onClose: (reason: PauseReason) => void;
}

export const StoryLinkOverlay: React.FC<StoryLinkOverlayProps> = ({
  showLinkOverlay,
  stickerData,
  onClose,
}) => {
  if (!showLinkOverlay) return null;

  const links = stickerData?.filter((s) => s.infoType === 'link') || [];

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-auto">
      <div 
        className="fixed inset-0 z-30" 
        onClick={(e) => {
          e.stopPropagation();
          onClose('link-overlay');
        }}
        data-story-controls
      />
      <div className="z-40 story-link-modal animate-in fade-in zoom-in-95 duration-200" data-story-controls>
        <ExternalLink className="size-6 text-primary" />
        <p className="text-sm font-medium text-foreground">Story has links</p>
        {links.map((sticker, idx) => (
          <a
            key={idx}
            href={sticker.content.startsWith('http') ? sticker.content : `https://${sticker.content}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-4" />
            <span className="max-w-[200px] truncate">{sticker.content.replace(/^https?:\/\//, '')}</span>
          </a>
        ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose('link-overlay');
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Continue viewing
        </button>
      </div>
    </div>
  );
};

interface StoryStickersProps {
  stickerData?: StoryStickerData[];
  onMentionClick?: (id: string) => void;
}

export const StoryStickers: React.FC<StoryStickersProps> = ({ stickerData, onMentionClick }) => {
  if (!stickerData || stickerData.length === 0) return null;

  const interactives = stickerData.filter((s) => s.infoType);
  if (interactives.length === 0) return null;

  return (
    <div className="absolute inset-0 z-[5] pointer-events-none">
      {interactives.map((sticker, idx) => {
        const isLink = sticker.infoType === 'link';
        const isMention = sticker.infoType === 'mention';
        
        // Link sticker
        if (isLink) {
          return (
            <a
              key={`interactive-${idx}`}
              href={sticker.content.startsWith('http') ? sticker.content : `https://${sticker.content}`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-bold border border-white/20 transition-all hover:scale-105"
              style={{
                left: `${sticker.x}%`,
                top: `${sticker.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={(e) => e.stopPropagation()}
              data-story-controls
            >
              <ExternalLink className="size-3" />
              <span className="max-w-[150px] truncate">{sticker.content.replace(/^https?:\/\//, '')}</span>
            </a>
          );
        }
        
        // Mention sticker
        if (isMention) {
          return (
            <div
              key={`interactive-${idx}`}
              className="absolute pointer-events-auto flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold shadow-lg transition-all hover:scale-105"
              style={{
                left: `${sticker.x}%`,
                top: `${sticker.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                // We could navigate to profile here, but for now we'll just log it or pass a callback
                if (sticker.mentionUserId) onMentionClick?.(sticker.mentionUserId);
              }}
              data-story-controls
            >
              <span className="max-w-[150px] truncate">{sticker.content}</span>
            </div>
          );
        }

        // Generic info sticker (fallback)
        return (
          <div
            key={`interactive-${idx}`}
            className="absolute pointer-events-auto flex items-center px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs font-bold border border-white/20"
            style={{
              left: `${sticker.x}%`,
              top: `${sticker.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="max-w-[150px] truncate">{sticker.content}</span>
          </div>
        );
      })}
    </div>
  );
};
