import React, { useRef, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollTriggeredAIInsightProps {
  content: string;
  className?: string;
}

export const ScrollTriggeredAIInsight: React.FC<ScrollTriggeredAIInsightProps> = ({ 
  content, 
  className 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        threshold: 0.5, // Trigger when 50% of the element is visible
        rootMargin: '-50px 0px', // Offset to trigger slightly before/after
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, []);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div 
      ref={elementRef}
      className={cn(
        "transition-all duration-700 ease-out cursor-pointer",
        className
      )}
      onClick={handleToggle}
    >
      {/* Icon and animated text */}
      <div className="flex items-center p-2 hover:bg-muted/30 rounded-lg transition-colors relative">
        {/* Icon - always visible */}
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 relative z-10">
          <Sparkles className="w-3 h-3 text-primary" />
        </div>
        
        {/* Text - slides out from behind the icon when visible */}
        <div className="overflow-hidden">
          <span className={cn(
            "text-sm font-medium text-primary whitespace-nowrap ml-2 block transition-all duration-700 ease-out",
            isVisible 
              ? "transform translate-x-0 opacity-100" 
              : "transform -translate-x-6 opacity-0"
          )}>
            AI Insight
          </span>
        </div>
      </div>

      {/* Expandable content */}
      <div 
        className={cn(
          "transition-all duration-500 ease-out overflow-hidden",
          isExpanded 
            ? "opacity-100 max-h-96 mt-2" 
            : "opacity-0 max-h-0 mt-0"
        )}
      >
        <div className="p-4 bg-muted/30 rounded-lg border border-primary/5">
          <p className="text-muted-foreground leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
};