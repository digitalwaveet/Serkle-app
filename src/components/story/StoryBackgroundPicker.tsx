import React from 'react';
import { Check, X } from 'lucide-react';
import { STORY_GRADIENTS, StoryGradientPreset } from '@/lib/storyGradients';

interface Props {
  selectedCss: string;
  onSelect: (gradient: StoryGradientPreset) => void;
  onClose: () => void;
}

const StoryBackgroundPicker: React.FC<Props> = ({ selectedCss, onSelect, onClose }) => {
  return (
    <div className="bg-black/85 backdrop-blur-md rounded-t-2xl border-t border-white/10">
      <div className="flex items-center justify-between p-3">
        <h3 className="text-white font-semibold">Background</h3>
        <button
          type="button"
          aria-label="Close backgrounds"
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] scrollbar-hide">
        {STORY_GRADIENTS.map((gradient) => {
          const isSelected = gradient.css === selectedCss;
          return (
            <button
              type="button"
              key={gradient.id}
              aria-label={`${gradient.name} background`}
              aria-pressed={isSelected}
              onClick={() => onSelect(gradient)}
              className={`flex flex-col items-center gap-1.5 shrink-0 transition-transform ${
                isSelected ? 'scale-105' : ''
              }`}
            >
              <div
                className={`relative w-12 h-[72px] rounded-xl border-2 transition-colors flex items-center justify-center shadow-md ${
                  isSelected ? 'border-white' : 'border-white/20'
                }`}
                style={{ background: gradient.css }}
              >
                {isSelected && (
                  <span className="size-6 rounded-full bg-black/50 text-white flex items-center justify-center">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isSelected ? 'text-white' : 'text-white/70'
                }`}
              >
                {gradient.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StoryBackgroundPicker;
