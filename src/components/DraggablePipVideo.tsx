import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PictureInPicture, Volume2, VolumeX } from 'lucide-react';

interface DraggablePipVideoProps {
  videoSrc: string;
  isPlaying: boolean;
  isMuted: boolean;
  onMuteToggle: () => void;
  onRestore: () => void;
  title?: string;
}

export const DraggablePipVideo: React.FC<DraggablePipVideoProps> = ({
  videoSrc,
  isPlaying,
  isMuted,
  onMuteToggle,
  onRestore,
  title
}) => {
  const baseWidth = 200;
  const baseHeight = 356; // 16:9 aspect ratio
  
  const [position, setPosition] = useState({ 
    x: window.innerWidth - baseWidth * 0.6 - 5, // 5px space from right edge
    y: window.innerHeight - baseHeight * 0.6 - 70 // Narrower gap above comment input (approx 70px)
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.6);
  const [isPinching, setIsPinching] = useState(false);
  const [pinchData, setPinchData] = useState({
    startDistance: 0,
    startScale: 0.6,
    center: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 }
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle video playback
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(console.error);
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Handle mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
      e.preventDefault();
    }
  }, []);

  const getDistance = (touch1: Touch | React.Touch, touch2: Touch | React.Touch) => {
    return Math.sqrt(
      Math.pow(touch1.clientX - touch2.clientX, 2) + 
      Math.pow(touch1.clientY - touch2.clientY, 2)
    );
  };

  const getPinchCenter = (touch1: Touch | React.Touch, touch2: Touch | React.Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const snapToEdgeOrCorner = useCallback((currentPos: { x: number; y: number }, currentScale: number) => {
    const containerWidth = baseWidth * currentScale;
    const containerHeight = baseHeight * currentScale;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const rightMargin = 5; // 5px space from right edge
    const bottomMargin = 70; // Narrower space above comment input section
    const topMargin = 10; // Small top margin
    const leftMargin = 10; // Small left margin
    const snapThreshold = 30; // Distance threshold for edge snapping

    // Define edge and corner positions with proper margins
    const positions = [
      // Corners
      { x: leftMargin, y: topMargin, type: 'corner' }, // top-left
      { x: windowWidth - containerWidth - rightMargin, y: topMargin, type: 'corner' }, // top-right
      { x: leftMargin, y: windowHeight - containerHeight - bottomMargin, type: 'corner' }, // bottom-left
      { x: windowWidth - containerWidth - rightMargin, y: windowHeight - containerHeight - bottomMargin, type: 'corner' }, // bottom-right
      
      // Edges (center of edges)
      { x: windowWidth - containerWidth - rightMargin, y: (windowHeight - containerHeight - bottomMargin - topMargin) / 2 + topMargin, type: 'edge' }, // right edge center
      { x: leftMargin, y: (windowHeight - containerHeight - bottomMargin - topMargin) / 2 + topMargin, type: 'edge' }, // left edge center  
      { x: (windowWidth - containerWidth - rightMargin - leftMargin) / 2 + leftMargin, y: topMargin, type: 'edge' }, // top edge center
      { x: (windowWidth - containerWidth - rightMargin - leftMargin) / 2 + leftMargin, y: windowHeight - containerHeight - bottomMargin, type: 'edge' }, // bottom edge center
    ];

    // Find closest position
    let closestPosition = positions[0];
    let minDistance = Infinity;

    positions.forEach(pos => {
      const distance = Math.sqrt(
        Math.pow(currentPos.x - pos.x, 2) + Math.pow(currentPos.y - pos.y, 2)
      );
      
      // Prioritize right edge positions when close
      const isRightEdge = pos.x === windowWidth - containerWidth - rightMargin;
      const adjustedDistance = isRightEdge && distance < snapThreshold ? distance * 0.5 : distance;
      
      if (adjustedDistance < minDistance) {
        minDistance = adjustedDistance;
        closestPosition = pos;
      }
    });

    return { x: closestPosition.x, y: closestPosition.y };
  }, [baseWidth, baseHeight]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current) {
      if (e.touches.length === 1) {
        // Single touch - dragging
        const rect = containerRef.current.getBoundingClientRect();
        const touch = e.touches[0];
        setDragOffset({
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        });
        setIsDragging(true);
        setIsPinching(false);
      } else if (e.touches.length === 2) {
        // Two fingers - pinching
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        const distance = getDistance(touch1, touch2);
        const center = getPinchCenter(touch1, touch2);
        
        setPinchData({
          startDistance: distance,
          startScale: scale,
          center: center,
          startPosition: position
        });
        setIsPinching(true);
        setIsDragging(false);
      }
      e.preventDefault();
    }
  }, [scale, position]);

  useEffect(() => {
    if (!isDragging && !isPinching) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const containerWidth = baseWidth * scale;
        const containerHeight = baseHeight * scale;

        const rightMargin = 5;
        const bottomMargin = 70; // Narrower space above comment input
        const topMargin = 10;
        const leftMargin = 10;
        
        const newX = Math.max(leftMargin, Math.min(windowWidth - containerWidth - rightMargin, e.clientX - dragOffset.x));
        const newY = Math.max(topMargin, Math.min(windowHeight - containerHeight - bottomMargin, e.clientY - dragOffset.y));

        setPosition({ x: newX, y: newY });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isPinching && e.touches.length === 2) {
        // Handle pinch scaling with proper center-based scaling
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const currentCenter = getPinchCenter(e.touches[0], e.touches[1]);
        
        // Calculate scale factor
        const scaleFactor = currentDistance / pinchData.startDistance;
        const newScale = Math.max(0.5, Math.min(2.5, pinchData.startScale * scaleFactor));
        
        // Calculate position adjustment to keep pinch center fixed
        const oldContainerWidth = baseWidth * pinchData.startScale;
        const oldContainerHeight = baseHeight * pinchData.startScale;
        const newContainerWidth = baseWidth * newScale;
        const newContainerHeight = baseHeight * newScale;
        
        // Find the relative position of pinch center within the container
        const relativeX = (pinchData.center.x - pinchData.startPosition.x) / oldContainerWidth;
        const relativeY = (pinchData.center.y - pinchData.startPosition.y) / oldContainerHeight;
        
        // Calculate new position to maintain pinch center
        const newX = currentCenter.x - (relativeX * newContainerWidth);
        const newY = currentCenter.y - (relativeY * newContainerHeight);
        
        // Apply bounds checking with proper margins
        const rightMargin = 5;
        const bottomMargin = 70; // Narrower space above comment input
        const topMargin = 10;
        const leftMargin = 10;
        
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const boundedX = Math.max(leftMargin, Math.min(windowWidth - newContainerWidth - rightMargin, newX));
        const boundedY = Math.max(topMargin, Math.min(windowHeight - newContainerHeight - bottomMargin, newY));
        
        setScale(newScale);
        setPosition({ x: boundedX, y: boundedY });
        
      } else if (isDragging && e.touches.length === 1) {
        // Handle dragging
        const touch = e.touches[0];
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const containerWidth = baseWidth * scale;
        const containerHeight = baseHeight * scale;

        const rightMargin = 5;
        const bottomMargin = 70; // Narrower space above comment input
        const topMargin = 10;
        const leftMargin = 10;

        const newX = Math.max(leftMargin, Math.min(windowWidth - containerWidth - rightMargin, touch.clientX - dragOffset.x));
        const newY = Math.max(topMargin, Math.min(windowHeight - containerHeight - bottomMargin, touch.clientY - dragOffset.y));

        setPosition({ x: newX, y: newY });
      }
      e.preventDefault();
    };

    const handleEnd = () => {
      if (isPinching) {
        // Snap to edge or corner on release
        const snappedPosition = snapToEdgeOrCorner(position, scale);
        setPosition(snappedPosition);
      } else if (isDragging) {
        // Also snap after dragging for better UX
        const snappedPosition = snapToEdgeOrCorner(position, scale);
        setPosition(snappedPosition);
      }
      setIsDragging(false);
      setIsPinching(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, isPinching, dragOffset, scale, pinchData, position, snapToEdgeOrCorner, baseWidth, baseHeight]);

  return (
    <div
      ref={containerRef}
      className={`fixed z-[200] bg-black rounded-lg shadow-2xl overflow-hidden select-none transition-all duration-300 ${
        isDragging || isPinching ? 'cursor-grabbing' : 'cursor-grab'
      } ${isPinching ? 'shadow-primary/20 shadow-2xl' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${baseWidth * scale}px`,
        height: `${baseHeight * scale}px`,
        transformOrigin: 'center center'
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={videoSrc}
        className="w-full h-full object-cover"
        loop
        playsInline
        muted={isMuted}
        onLoadedData={() => {
          if (isPlaying && videoRef.current) {
            videoRef.current.play().catch(console.error);
          }
        }}
      />

      {/* Controls overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/30 opacity-0 hover:opacity-100 transition-opacity duration-200">
        {/* Top controls */}
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMuteToggle();
            }}
            className="w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            {isMuted ? (
              <VolumeX className="w-3 h-3" />
            ) : (
              <Volume2 className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            className="w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <PictureInPicture className="w-3 h-3" />
          </button>
        </div>

        {/* Title at bottom if provided */}
        {title && (
          <div className="absolute bottom-2 left-2 right-2">
            <p className="text-white text-xs font-medium truncate">
              {title}
            </p>
          </div>
        )}
      </div>

      {/* Interactive feedback indicators */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/20 border-2 border-primary/50 rounded-lg pointer-events-none animate-pulse" />
      )}
      {isPinching && (
        <div className="absolute inset-0 bg-secondary/20 border-2 border-secondary/50 rounded-lg pointer-events-none">
          <div className="absolute top-2 left-2 text-white text-xs bg-black/50 rounded px-2 py-1 backdrop-blur-sm">
            {Math.round(scale * 100)}%
          </div>
        </div>
      )}
    </div>
  );
};