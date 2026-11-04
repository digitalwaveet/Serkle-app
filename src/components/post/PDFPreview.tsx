import React from 'react';
import { PDFCarousel } from './PDFCarousel';
import { X, Wand2 } from 'lucide-react';

interface PDFPreviewProps {
  pages: { blob: Blob; url: string }[];
  fileName: string;
  onRemove: () => void;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({ 
  pages, 
  fileName, 
  onRemove 
}) => {
  const imageUrls = pages.map(p => p.url);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Wand2 className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black text-foreground uppercase tracking-wider">Document Preview</h3>
            <p className="text-[10px] text-muted-foreground font-medium truncate max-w-[200px]">
              {fileName}
            </p>
          </div>
        </div>
        <button 
          onClick={onRemove}
          className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="aspect-[4/5] w-full">
        <PDFCarousel pages={imageUrls} className="h-full shadow-2xl" />
      </div>

      <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest text-center mb-1">
          Pro Tip
        </p>
        <p className="text-xs text-center text-foreground/80 leading-relaxed font-medium">
          Your PDF will be displayed as a high-quality vertical carousel. 
          Followers can swipe through pages just like on LinkedIn.
        </p>
      </div>
    </div>
  );
};
