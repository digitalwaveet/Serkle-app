import React, { useEffect } from 'react';
import { Story } from '@/types/storyTypes';
import { StoryCanvas } from './StoryCanvas';

interface Props {
  story: Story;
  videoRef: React.RefObject<HTMLVideoElement>;
  paused: boolean;
  muted: boolean;
  onReady: () => void;
  onError: () => void;
  onWaiting: () => void;
  onMentionClick: (id: string) => void;
}

export function StoryMediaRenderer({ story, videoRef, paused, muted, onReady, onError, onWaiting, onMentionClick }: Props) {
  const staticBackground = story.story_state?.background.type === 'color' || story.story_state?.background.type === 'gradient';
  useEffect(() => { if (staticBackground) onReady(); }, [staticBackground]);
  if (story.story_state) return <div className="absolute inset-0">
    <StoryCanvas state={story.story_state} videoRef={videoRef} paused={paused} muted={muted}
      onMediaReady={onReady} onMediaError={onError} onMediaWaiting={onWaiting} onMentionClick={onMentionClick} />
  </div>;
  const videoStyle: React.CSSProperties | undefined = story.videoTransform ? {
    position: 'absolute', left: `${story.videoTransform.x / story.videoTransform.canvasW * 100}%`,
    top: `${story.videoTransform.y / story.videoTransform.canvasH * 100}%`,
    transform: `translate(-50%,-50%) scale(${story.videoTransform.scale}) rotate(${story.videoTransform.rotation}deg)`,
    maxWidth: 'none', maxHeight: 'none',
  } : undefined;
  return <div className="absolute inset-0 overflow-hidden">
    {story.mediaType === 'video' ? <video ref={videoRef} src={story.image} className={videoStyle ? '' : 'w-full h-full object-contain'}
      style={videoStyle} autoPlay={!paused} muted={muted} playsInline preload="auto"
      onLoadedMetadata={event => {
        const video = event.currentTarget;
        if (story.videoTransform) {
          const transform = story.videoTransform;
          const fit = Math.min((transform.canvasW - 24) / video.videoWidth, (transform.canvasH - 24) / video.videoHeight, 1);
          video.style.width = `${video.videoWidth * fit / transform.canvasW * 100}%`;
        }
      }}
      onCanPlay={onReady} onError={onError} onWaiting={onWaiting}
    /> : <img src={story.image} alt={`${story.user.name}'s story`} className="w-full h-full object-contain" draggable={false} onLoad={onReady} onError={onError} />}
    {story.overlayUrl && <img src={story.overlayUrl} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" onError={onError} />}
  </div>;
}
