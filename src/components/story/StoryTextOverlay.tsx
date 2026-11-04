import React, { useState } from 'react';
import { Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Check, X, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoryElement } from '@/types/storyTypes';

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00',
  '#34C759', '#007AFF', '#AF52DE', '#FF2D55', '#5856D6',
];

const BG_OPTIONS = [
  'transparent', 'rgba(0,0,0,0.6)', 'rgba(255,255,255,0.8)',
  'rgba(255,59,48,0.7)', 'rgba(0,122,255,0.7)', 'rgba(175,82,222,0.7)',
];

const FONTS = [
  { id: 'classic', name: 'Classic', value: 'sans-serif' },
  { id: 'modern', name: 'Modern', value: 'system-ui, -apple-system, sans-serif' },
  { id: 'neon', name: 'Neon', value: 'cursive' },
  { id: 'typewriter', name: 'Typewriter', value: 'monospace' },
  { id: 'strong', name: 'Strong', value: 'Impact, sans-serif' }
];

interface Props {
  initialElement?: StoryElement;
  onAdd: (overlay: any) => void;
  onClose: () => void;
}

export interface TextOverlay {
  id?: string; text: string; x: number; y: number; fontSize: number;
  fontFamily?: string; fontWeight: 'normal' | 'bold'; fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right'; color: string; bgColor: string;
}

const StoryTextOverlay: React.FC<Props> = ({ onAdd, onClose, initialElement }) => {
  const [text, setText] = useState(initialElement?.content || '');
  const [fontSize, setFontSize] = useState(initialElement?.fontSize || 60);
  const [fontFamily, setFontFamily] = useState(initialElement?.fontFamily || FONTS[0].value);
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>(initialElement?.fontWeight || 'bold');
  const [fontStyle, setFontStyle] = useState<'normal' | 'italic'>(initialElement?.fontStyle || 'normal');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(initialElement?.textAlign || 'center');
  const [color, setColor] = useState(initialElement?.color || '#FFFFFF');
  const [bgColor, setBgColor] = useState(initialElement?.bgColor || 'transparent');

  const handleConfirm = () => {
    if (!text.trim()) return;
    onAdd({
      text: text.trim(),
      x: 50,
      y: 50,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      textAlign,
      color,
      bgColor,
    });
  };

  return (
    <div className="absolute inset-0 z-[150] bg-black/60 flex flex-col pointer-events-auto backdrop-blur-sm">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4">
        <button aria-label="Cancel text editing" onClick={onClose} className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors">
          <X className="w-6 h-6" />
        </button>
        <Button size="sm" onClick={handleConfirm} disabled={!text.trim()}
          className="bg-white text-black hover:bg-white/90 rounded-full px-6 font-semibold shadow-lg">
          Done
        </Button>
      </div>

      {/* Text input area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative">
        <textarea
          aria-label="Story text"
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type something..."
          autoFocus
          className="bg-transparent border-none outline-none resize-none w-full max-w-[1080px] leading-tight"
          style={{
            // Scale font size down for typing preview to fit screen nicely
            fontSize: `${fontSize / 1.5}px`, 
            fontFamily,
            fontWeight,
            fontStyle,
            textAlign,
            color,
            backgroundColor: bgColor,
            borderRadius: bgColor !== 'transparent' ? '16px' : undefined,
            padding: bgColor !== 'transparent' ? '16px 24px' : undefined,
            boxShadow: color === '#FFFFFF' && fontFamily === 'cursive' && bgColor === 'transparent' ? '0 0 10px #fff, 0 0 20px #fff' : 'none'
          }}
          rows={4}
        />
      </div>

      {/* Tools */}
      <div className="p-4 space-y-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-8">
        
        {/* Font Selector */}
        <div className="flex justify-center gap-2 overflow-x-auto snap-x px-2 py-1">
          {FONTS.map(f => (
            <button 
              key={f.id}
              onClick={() => setFontFamily(f.value)}
              className={`px-4 py-1.5 rounded-full whitespace-nowrap snap-center text-sm font-semibold transition-colors ${fontFamily === f.value ? 'bg-white text-black' : 'bg-black/50 text-white border border-white/20'}`}
              style={{ fontFamily: f.value }}
            >
              {f.name}
            </button>
          ))}
        </div>

        {/* Font size slider */}
        <div className="flex items-center gap-4 px-4 max-w-sm mx-auto">
          <span className="text-white/70 text-xs">A</span>
          <input
            aria-label="Text size" type="range" min={30} max={150} value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="flex-1 accent-white"
          />
          <span className="text-white text-lg font-bold">A</span>
        </div>

        {/* Format buttons */}
        <div className="flex items-center justify-center gap-3">
          <button aria-label="Change text alignment" onClick={() => setTextAlign(textAlign === 'left' ? 'center' : textAlign === 'center' ? 'right' : 'left')}
            className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20">
            {textAlign === 'left' && <AlignLeft className="w-5 h-5" />}
            {textAlign === 'center' && <AlignCenter className="w-5 h-5" />}
            {textAlign === 'right' && <AlignRight className="w-5 h-5" />}
          </button>
          
          {/* Background pills toggle */}
          <button aria-label="Change text background" onClick={() => setBgColor(bgColor === 'transparent' ? 'rgba(0,0,0,0.6)' : bgColor === 'rgba(0,0,0,0.6)' ? 'rgba(255,255,255,0.8)' : 'transparent')}
            className={`p-2.5 rounded-full text-white ${bgColor !== 'transparent' ? 'bg-white text-black' : 'bg-white/10'}`}>
            <span className="font-serif font-bold px-1">A**</span>
          </button>
        </div>

        {/* Text colors */}
        <div className="flex items-center gap-3 justify-center overflow-x-auto px-2 snap-x py-2">
          {TEXT_COLORS.map((c) => (
            <button aria-label={`Text color ${c}`} aria-pressed={color === c} key={c} onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full flex-shrink-0 snap-center border-2 ${color === c ? 'border-white scale-110' : 'border-transparent'} transition-transform`}
              style={{ backgroundColor: c, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default StoryTextOverlay;
