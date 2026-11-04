import { useState, useMemo, useCallback } from 'react';
import React from 'react';

interface UseVirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

interface VirtualScrollReturn {
  visibleStartIndex: number;
  visibleEndIndex: number;
  totalHeight: number;
  offsetY: number;
  visibleItems: number[];
}

export const useVirtualScroll = (
  itemCount: number,
  { itemHeight, containerHeight, overscan = 5 }: UseVirtualScrollOptions
): VirtualScrollReturn => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStartIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleEndIndex = Math.min(
    itemCount - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = useMemo(
    () => Array.from({ length: visibleEndIndex - visibleStartIndex + 1 }, (_, i) => visibleStartIndex + i),
    [visibleStartIndex, visibleEndIndex]
  );

  const totalHeight = itemCount * itemHeight;
  const offsetY = visibleStartIndex * itemHeight;

  return {
    visibleStartIndex,
    visibleEndIndex,
    totalHeight,
    offsetY,
    visibleItems,
  };
};

interface VirtualScrollContainerProps {
  children: (item: number, index: number) => React.ReactNode;
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
}

export const VirtualScrollContainer: React.FC<VirtualScrollContainerProps> = ({
  children,
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 5,
  className = '',
  onScroll,
}) => {
  const { visibleStartIndex, visibleEndIndex, totalHeight, offsetY, visibleItems } = useVirtualScroll(
    itemCount,
    { itemHeight, containerHeight, overscan }
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    onScroll?.(target.scrollTop);
  }, [onScroll]);

  return (
    <div
      className={`scroll-optimized scrollbar-thin ${className}`}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((itemIndex, index) => (
            <div
              key={itemIndex}
              style={{
                height: itemHeight,
                position: 'relative',
              }}
              className="content-visibility-auto"
            >
              {children(itemIndex, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};