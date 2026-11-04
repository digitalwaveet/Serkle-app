import React, { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PDFCarouselProps {
  pages: string[]; // Page image URLs
  className?: string;
  initialPage?: number;
}

export const PDFCarousel: React.FC<PDFCarouselProps> = ({ 
  pages, 
  className,
  initialPage = 0 
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    startIndex: initialPage,
    skipSnaps: false
  });
  
  const [selectedIndex, setSelectedIndex] = useState(initialPage);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  return (
    <div className={cn("relative group select-none overflow-hidden rounded-2xl border border-border bg-muted/20", className)}>
      {/* Page Indicator Badge */}
      <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2">
        <FileText className="w-3 h-3 text-white/80" />
        <span className="text-[10px] font-black text-white tracking-widest">
          {selectedIndex + 1} / {pages.length}
        </span>
      </div>

      {/* Main Carousel */}
      <div className="overflow-hidden h-full" ref={emblaRef}>
        <div className="flex h-full">
          {pages.map((url, index) => (
            <div key={index} className="relative flex-[0_0_100%] min-w-0 h-full flex items-center justify-center bg-white dark:bg-zinc-950">
              <img
                src={url}
                alt={`Page ${index + 1}`}
                className="max-w-full max-h-full object-contain shadow-2xl"
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows (Desktop) */}
      <div className="hidden md:block">
        <button
          onClick={scrollPrev}
          disabled={!emblaApi?.canScrollPrev()}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur-xl text-white border border-white/20 opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-all hover:bg-white/20 active:scale-95 z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={scrollNext}
          disabled={!emblaApi?.canScrollNext()}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur-xl text-white border border-white/20 opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-all hover:bg-white/20 active:scale-95 z-10"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
        <div 
          className="h-full bg-primary transition-all duration-300 ease-out" 
          style={{ width: `${((selectedIndex + 1) / pages.length) * 100}%` }}
        />
      </div>
    </div>
  );
};
