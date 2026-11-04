import React, { useRef, useEffect, useState } from 'react';
import { getStroke } from 'perfect-freehand';
import { StoryState, StoryElement, DrawingPath } from '@/types/storyTypes';

interface StoryCanvasProps {
  state: StoryState;
  className?: string;
  children?: React.ReactNode; // For editor overlays or viewer UI that sit ON TOP of the scaled canvas
  videoRef?: React.Ref<HTMLVideoElement>;
  onVideoLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
  onMediaReady?: () => void;
  onMediaError?: () => void;
  onMediaWaiting?: () => void;
  paused?: boolean;
  muted?: boolean;
  onMentionClick?: (userId: string) => void;
}

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
}

export function StoryCanvas({ state, className = '', children, videoRef, onVideoLoadedMetadata, onMediaReady, onMediaError, onMediaWaiting, paused = false, muted = true, onMentionClick }: StoryCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    containerRef.current?.querySelectorAll('video').forEach(video => {
      if (paused) video.pause(); else void video.play().catch(() => {});
    });
  }, [paused, state.background.value]);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      // We want to scale based on the available height or width to maintain 9:16
      // The container determines the bounding box.
      const heightScale = rect.height / CANVAS_H;
      const widthScale = rect.width / CANVAS_W;
      
      // Use the smaller scale so it fits entirely inside the container
      const finalScale = Math.min(heightScale, widthScale);
      setScale(finalScale);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateScale);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  const renderBackground = () => {
    const { background } = state;
    if (!background) return <div className="absolute inset-0 bg-black" />;

    const fitMode = background.objectFit || 'cover';
    const transform = `translate(-50%, -50%) scale(${background.scale ?? 1}) rotate(${background.rotation ?? 0}deg)`;
    const bgStyle: React.CSSProperties = {
      position: 'absolute',
      left: background.x !== undefined ? `${background.x}%` : '50%',
      top: background.y !== undefined ? `${background.y}%` : '50%',
      width: '100%',
      height: '100%',
      transform,
      transformOrigin: 'center center',
      pointerEvents: 'none'
    };

    switch (background.type) {
      case 'color':
        return <div style={{ ...bgStyle, backgroundColor: background.value }} />;
      case 'gradient':
        return <div style={{ ...bgStyle, background: background.value }} />;
      case 'image':
        if (fitMode === 'contain') {
          return (
            <>
              {/* Blurred backdrop — fills canvas, always object-cover */}
              <img
                src={background.value}
                alt=""
                className="object-cover"
                style={{
                  ...bgStyle,
                  filter: `blur(30px) brightness(0.6) ${background.filterCss || ''}`.trim(),
                  transform: `translate(-50%, -50%) scale(${(background.scale ?? 1) * 1.15}) rotate(${background.rotation ?? 0}deg)`,
                }}
              />
              {/* Main image — no cropping, object-contain */}
              <img
                src={background.value}
                alt="background"
                onLoad={onMediaReady}
                onError={onMediaError}
                className="object-contain"
                style={{ ...bgStyle, filter: background.filterCss || 'none' }}
              />
            </>
          );
        }
        return (
          <img 
            src={background.value} 
            alt="background" 
            onLoad={onMediaReady}
            onError={onMediaError}
            className="object-cover" 
            style={{ ...bgStyle, filter: background.filterCss || 'none' }}
          />
        );
      case 'video':
        if (fitMode === 'contain') {
          return (
            <>
              <video
                src={background.value}
                className="object-cover"
                autoPlay={!paused} loop muted playsInline
                style={{
                  ...bgStyle,
                  filter: `blur(30px) brightness(0.6) ${background.filterCss || ''}`.trim(),
                  transform: `translate(-50%, -50%) scale(${(background.scale ?? 1) * 1.15}) rotate(${background.rotation ?? 0}deg)`,
                }}
              />
              <video 
                ref={videoRef}
                src={background.value} 
                className="object-contain" 
                autoPlay={!paused} loop muted={muted} playsInline
                style={{ ...bgStyle, filter: background.filterCss || 'none' }}
                onLoadedMetadata={onVideoLoadedMetadata}
                onCanPlay={onMediaReady}
                onError={onMediaError}
                onWaiting={onMediaWaiting}
              />
            </>
          );
        }
        return (
          <video 
            ref={videoRef}
            src={background.value} 
            className="object-cover" 
            autoPlay={!paused} loop muted={muted} playsInline
            style={{ ...bgStyle, filter: background.filterCss || 'none' }}
            onLoadedMetadata={onVideoLoadedMetadata}
            onCanPlay={onMediaReady}
            onError={onMediaError}
            onWaiting={onMediaWaiting}
          />
        );
      default:
        return <div className="absolute inset-0 bg-black" />;
    }
  };

  const renderElement = (el: StoryElement) => {
    const left = `${el.x}%`;
    const top = `${el.y}%`;
    const transform = `translate(-50%, -50%) scale(${el.scale}) rotate(${el.rotation}deg)`;
    const zIndex = el.zIndex;

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left,
      top,
      transform,
      zIndex,
      transformOrigin: 'center center',
      pointerEvents: 'none', // Interactive overlays will handle clicks
    };

    if (el.type === 'text') {
      return (
        <div
          key={el.id}
          data-el-id={el.id}
          style={{
            ...baseStyle,
            fontSize: `${el.fontSize || 40}px`,
            fontFamily: el.fontFamily || 'sans-serif',
            fontWeight: el.fontWeight || 'normal',
            fontStyle: el.fontStyle || 'normal',
            color: el.color || 'white',
            backgroundColor: el.bgColor || 'transparent',
            textAlign: el.textAlign || 'center',
            padding: el.bgColor && el.bgColor !== 'transparent' ? '12px 24px' : '0px',
            borderRadius: '16px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            width: 'max-content',
            maxWidth: `${CANVAS_W * 0.9}px`, // Don't let text go wider than 90% of canvas
          }}
        >
          {el.content}
        </div>
      );
    }

    if (el.type === 'emoji') {
      return (
        <div key={el.id} data-el-id={el.id} style={{ ...baseStyle, fontSize: '100px' }}>
          {el.content}
        </div>
      );
    }

    if (el.type === 'info') {
      const text = <>{el.infoType === 'location' ? '📍 ' : el.infoType === 'mention' ? '@' : el.infoType === 'hashtag' ? '#' : el.infoType === 'link' ? '↗ ' : ''}{el.content}</>;
      const classes = "bg-black/60 backdrop-blur-md px-6 py-3 rounded-full text-white font-medium text-3xl border border-white/20 flex items-center gap-3";
      if (onMentionClick && el.infoType === 'mention' && el.mentionUserId) return <button key={el.id} data-story-controls data-el-id={el.id} style={{ ...baseStyle, pointerEvents: 'auto' }} className={classes} onClick={() => onMentionClick(el.mentionUserId!)}>{text}</button>;
      if (onMentionClick && el.infoType === 'link' && el.content) {
        let url: URL | undefined;
        try { url = new URL(el.content.includes('://') ? el.content : 'https://' + el.content); } catch { /* non-link label */ }
        if (url && ['https:', 'http:'].includes(url.protocol)) return <a key={el.id} data-story-controls data-el-id={el.id} style={{ ...baseStyle, pointerEvents: 'auto' }} className={classes} href={url.href} target="_blank" rel="noopener noreferrer">{text}</a>;
      }
      return (
        <div
          key={el.id}
          data-el-id={el.id}
          style={baseStyle}
          className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full text-white font-medium text-3xl border border-white/20 flex items-center gap-3"
        >
          {el.infoType === 'location' && '📍 '}
          {el.infoType === 'mention' && '@'}
          {el.infoType === 'hashtag' && '#'}
          {el.infoType === 'link' && '🔗 '}
          {el.content}
        </div>
      );
    }

    if (el.type === 'image') {
      return (
        <img
          key={el.id}
          data-el-id={el.id}
          src={el.content}
          alt=""
          style={{ ...baseStyle, filter: el.filterCss || 'none' }}
          draggable={false}
        />
      );
    }

    if (el.type === 'video') {
      return (
        <video
          key={el.id}
          data-el-id={el.id}
          src={el.content}
          style={{ ...baseStyle, filter: el.filterCss || 'none' }}
          autoPlay loop muted playsInline
        />
      );
    }

    return null;
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative flex items-center justify-center w-full h-full overflow-hidden ${className}`}
    >
      {/* 
        This is the fixed 1080x1920 canvas that scales to fit its container.
      */}
      <div 
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          position: 'absolute',
          overflow: 'hidden',
          borderRadius: '16px', // Optional: slight rounding for editor preview aesthetics
          backgroundColor: '#000',
        }}
        className="story-canvas-inner shadow-2xl"
      >
        {renderBackground()}
        
        {/* Render elements */}
        {state.elements?.map(renderElement)}

        {/* Render drawing paths */}
        {state.drawingPaths && state.drawingPaths.length > 0 && (
          <svg className="absolute inset-0 pointer-events-none" width={CANVAS_W} height={CANVAS_H}>
            {state.drawingPaths.map(path => {
              const stroke = getStroke(path.points, {
                size: path.size,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5,
              });
              const d = getSvgPathFromStroke(stroke);
              return <path key={path.id} d={d} fill={path.color} />;
            })}
          </svg>
        )}

        {/* Optional overlay children (like grid lines, drawing target) */}
        {children}
      </div>
    </div>
  );
}
