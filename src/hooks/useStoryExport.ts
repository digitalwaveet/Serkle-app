import { RefObject } from 'react';
import { StickerItem } from '@/components/story/StoryStickerPicker';
import { TextOverlay } from '@/components/story/StoryTextOverlay';

export interface ImageSticker {
  id: string;
  src: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  isVideo?: boolean;
}

export interface EditorExtraData {
  originalVideoUrl?: string;
  mediaType: 'image' | 'video';
  overlayBlob?: Blob;
  videoTransform?: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
    canvasW: number;
    canvasH: number;
  };
  backgroundGradient?: {
    from: string;
    to: string;
  };
  stickerData?: Array<{
    type: 'emoji' | 'info';
    content: string;
    infoType?: string;
    mentionUserId?: string;
    x: number;
    y: number;
  }>;
}

interface UseStoryExportProps {
  canvasW: number;
  canvasH: number;
  safeW: number;
  safeH: number;
  addedImgMax: number;
  initialMediaRatio: number | null;
  imageStickers: ImageSticker[];
  textOverlays: TextOverlay[];
  emojiStickers: StickerItem[];
  deletingId: string | null;
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  isInitialVideo: boolean;
  previewUrl: string;
  filterCss?: string;
  onDone: (editedImageBlob: Blob, mentionedUserIds?: string[], extraData?: EditorExtraData) => void;
}

export const useStoryExport = ({
  canvasW,
  canvasH,
  safeW,
  safeH,
  addedImgMax,
  initialMediaRatio,
  imageStickers,
  textOverlays,
  emojiStickers,
  deletingId,
  videoRefs,
  isInitialVideo,
  previewUrl,
  filterCss,
  onDone,
}: UseStoryExportProps) => {
  const handleExport = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasW * 2;
    canvas.height = canvasH * 2;
    const scaleX = canvas.width / canvasW;
    const scaleY = canvas.height / canvasH;
    const isPortrait916 = initialMediaRatio && Math.abs(initialMediaRatio - (canvasW / canvasH)) < 0.05;

    if (!isPortrait916) {
      // Draw Blurred Background Layer
      const initialSticker = imageStickers.find(s => s.id.startsWith('img-initial-'));
      if (initialSticker) {
        let bgSource: HTMLImageElement | HTMLVideoElement | null = null;
        if (initialSticker.isVideo) {
          bgSource = videoRefs.current.get(initialSticker.id) || null;
        } else {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = initialSticker.src;
          await new Promise((r) => img.onload = r);
          bgSource = img;
        }

        if (bgSource) {
          ctx.save();
          
          // 1. Draw blurred media (COVER)
          const sW = initialSticker.isVideo ? (bgSource as HTMLVideoElement).videoWidth : (bgSource as HTMLImageElement).width;
          const sH = initialSticker.isVideo ? (bgSource as HTMLVideoElement).videoHeight : (bgSource as HTMLImageElement).height;
          const coverScale = Math.max(canvas.width / sW, canvas.height / sH);
          const dW = sW * coverScale;
          const dH = sH * coverScale;

          // Simple canvas blur: draw at low res then scale up
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d')!;
          tempCanvas.width = 100;
          tempCanvas.height = 100 * (canvas.height / canvas.width);
          tempCtx.drawImage(bgSource, 0, 0, tempCanvas.width, tempCanvas.height);
          
          ctx.globalAlpha = 1.0;
          ctx.filter = 'blur(60px) brightness(0.7)'; // Modern browsers support this
          ctx.drawImage(tempCanvas, (canvas.width - dW) / 2, (canvas.height - dH) / 2, dW, dH);
          ctx.filter = 'none';
          
          // 2. Draw 30% black overlay
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.restore();
        }
      }
    } else {
      // Draw standard gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      const rootStyles = getComputedStyle(document.documentElement);
      const primaryHSL = rootStyles.getPropertyValue('--primary').trim();
      const secondaryHSL = rootStyles.getPropertyValue('--secondary').trim();
      gradient.addColorStop(0, `hsl(${primaryHSL})`);
      gradient.addColorStop(1, `hsl(${secondaryHSL})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Apply global filter before drawing stickers if there's a filter
    if (filterCss && filterCss !== 'none') {
      ctx.filter = filterCss;
    }

    // Draw image/video stickers
    for (const sticker of imageStickers) {
      if (sticker.id === deletingId) continue;

      let source: HTMLImageElement | HTMLVideoElement;

      if (sticker.isVideo) {
        // Grab the live video element for current frame
        const videoEl = videoRefs.current.get(sticker.id);
        if (!videoEl) continue;
        source = videoEl;
      } else {
        const stickerImg = new Image();
        stickerImg.crossOrigin = 'anonymous';
        stickerImg.src = sticker.src;
        try {
          await new Promise((resolve, reject) => { stickerImg.onload = resolve; stickerImg.onerror = reject; });
        } catch { continue; }
        source = stickerImg;
      }

      const srcW = sticker.isVideo ? (source as HTMLVideoElement).videoWidth || 400 : (source as HTMLImageElement).width;
      const srcH = sticker.isVideo ? (source as HTMLVideoElement).videoHeight || 700 : (source as HTMLImageElement).height;

      const isInitial = sticker.id.startsWith('img-initial-');
      const fitScale = isInitial
        ? Math.min(safeW / srcW, safeH / srcH, 1)
        : Math.min(addedImgMax / srcW, addedImgMax / srcH, 1);

      const drawW = srcW * sticker.scale * fitScale;
      const drawH = srcH * sticker.scale * fitScale;

      ctx.save();
      ctx.translate(sticker.x * scaleX, sticker.y * scaleY);
      ctx.rotate((sticker.rotation * Math.PI) / 180);

      // Add drop shadow for foreground media if it's the initial non-9:16 media
      if (isInitial && !isPortrait916) {
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 10;
      }

      ctx.drawImage(source, -drawW, -drawH, drawW * 2, drawH * 2);
      ctx.restore();
    }

    // Draw text overlays
    for (const overlay of textOverlays) {
      const x = (overlay.x / 100) * canvas.width;
      const y = (overlay.y / 100) * canvas.height;
      const scaledFontSize = (overlay.fontSize / 400) * canvas.width;
      ctx.font = `${overlay.fontStyle} ${overlay.fontWeight} ${scaledFontSize}px sans-serif`;
      ctx.textAlign = overlay.textAlign as CanvasTextAlign;
      ctx.textBaseline = 'middle';
      if (overlay.bgColor !== 'transparent') {
        const metrics = ctx.measureText(overlay.text);
        const pad = scaledFontSize * 0.3;
        ctx.fillStyle = overlay.bgColor;
        const bgX = overlay.textAlign === 'center' ? x - metrics.width / 2 - pad :
                     overlay.textAlign === 'right' ? x - metrics.width - pad : x - pad;
        ctx.beginPath();
        ctx.roundRect(bgX, y - scaledFontSize / 2 - pad, metrics.width + pad * 2, scaledFontSize + pad * 2, 8);
        ctx.fill();
      }
      ctx.fillStyle = overlay.color;
      ctx.fillText(overlay.text, x, y);
    }

    // Draw emoji stickers (skip info stickers like links/mentions, they are rendered via HTML)
    for (const sticker of emojiStickers) {
      if (sticker.infoType) continue; // Skip links, mentions, polls

      const x = (sticker.x / 100) * canvas.width;
      const y = (sticker.y / 100) * canvas.height;
      
      const size = canvas.width * 0.08;
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sticker.content, x, y);
    }

    const mentionedUserIds = emojiStickers
      .filter(s => s.infoType === 'mention' && s.mentionUserId)
      .map(s => s.mentionUserId!);

    // Collect sticker data for storage (needed for clickable links etc.)
    const allStickerData = emojiStickers.map(s => ({
      type: s.type,
      content: s.content,
      infoType: s.infoType,
      mentionUserId: s.mentionUserId,
      x: s.x,
      y: s.y,
    }));

    // Capture gradient colors for reconstruction
    const rootStyles2 = getComputedStyle(document.documentElement);
    const gradFrom = rootStyles2.getPropertyValue('--primary').trim();
    const gradTo = rootStyles2.getPropertyValue('--secondary').trim();

    // Capture the initial video sticker's transform
    const initialVideoSticker = isInitialVideo
      ? imageStickers.find(s => s.id.startsWith('img-initial-'))
      : null;

    const extraData: EditorExtraData = {
      mediaType: isInitialVideo ? 'video' : 'image',
      originalVideoUrl: isInitialVideo ? previewUrl : undefined,
      stickerData: allStickerData.length > 0 ? allStickerData : undefined,
      videoTransform: initialVideoSticker ? {
        x: initialVideoSticker.x,
        y: initialVideoSticker.y,
        scale: initialVideoSticker.scale,
        rotation: initialVideoSticker.rotation,
        canvasW: canvasW,
        canvasH: canvasH,
      } : undefined,
      backgroundGradient: isInitialVideo ? { from: gradFrom, to: gradTo } : undefined,
      // If we want to store filter info for videos, we could add it here
    };

    // For video stories with overlays, generate a transparent PNG overlay
    // Reset filter before drawing overlay
    ctx.filter = 'none';
    const hasOverlays = imageStickers.filter(s => !s.id.startsWith('img-initial-')).length > 0
      || textOverlays.length > 0
      || emojiStickers.length > 0;

    if (isInitialVideo && hasOverlays) {
      // Create a transparent overlay canvas (only non-video elements)
      const overlayCanvas = document.createElement('canvas');
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) {
        overlayCanvas.width = canvasW * 2;
        overlayCanvas.height = canvasH * 2;
        const oScaleX = overlayCanvas.width / canvasW;
        const oScaleY = overlayCanvas.height / canvasH;

        // Draw non-initial image stickers only
        for (const sticker of imageStickers) {
          if (sticker.id === deletingId || sticker.id.startsWith('img-initial-')) continue;
          if (sticker.isVideo) continue; // skip video stickers in overlay

          const stickerImg = new Image();
          stickerImg.crossOrigin = 'anonymous';
          stickerImg.src = sticker.src;
          try {
            await new Promise((resolve, reject) => { stickerImg.onload = resolve; stickerImg.onerror = reject; });
          } catch { continue; }

          const srcW = stickerImg.width;
          const srcH = stickerImg.height;
          const fitScale = Math.min(addedImgMax / srcW, addedImgMax / srcH, 1);
          const drawW = srcW * sticker.scale * fitScale;
          const drawH = srcH * sticker.scale * fitScale;

          overlayCtx.save();
          overlayCtx.translate(sticker.x * oScaleX, sticker.y * oScaleY);
          overlayCtx.rotate((sticker.rotation * Math.PI) / 180);
          overlayCtx.drawImage(stickerImg, -drawW, -drawH, drawW * 2, drawH * 2);
          overlayCtx.restore();
        }

        // Draw text overlays
        for (const overlay of textOverlays) {
          const x = (overlay.x / 100) * overlayCanvas.width;
          const y = (overlay.y / 100) * overlayCanvas.height;
          const scaledFontSize = (overlay.fontSize / 400) * overlayCanvas.width;
          overlayCtx.font = `${overlay.fontStyle} ${overlay.fontWeight} ${scaledFontSize}px sans-serif`;
          overlayCtx.textAlign = overlay.textAlign as CanvasTextAlign;
          overlayCtx.textBaseline = 'middle';
          if (overlay.bgColor !== 'transparent') {
            const metrics = overlayCtx.measureText(overlay.text);
            const pad = scaledFontSize * 0.3;
            overlayCtx.fillStyle = overlay.bgColor;
            const bgX = overlay.textAlign === 'center' ? x - metrics.width / 2 - pad :
                         overlay.textAlign === 'right' ? x - metrics.width - pad : x - pad;
            overlayCtx.beginPath();
            overlayCtx.roundRect(bgX, y - scaledFontSize / 2 - pad, metrics.width + pad * 2, scaledFontSize + pad * 2, 8);
            overlayCtx.fill();
          }
          overlayCtx.fillStyle = overlay.color;
          overlayCtx.fillText(overlay.text, x, y);
        }

        // Draw emoji stickers
        for (const sticker of emojiStickers) {
          if (sticker.infoType) continue; // Skip links, mentions, polls

          const x = (sticker.x / 100) * overlayCanvas.width;
          const y = (sticker.y / 100) * overlayCanvas.height;
          
          const size = overlayCanvas.width * 0.08;
          overlayCtx.font = `${size}px serif`;
          overlayCtx.textAlign = 'center';
          overlayCtx.textBaseline = 'middle';
          overlayCtx.fillText(sticker.content, x, y);
        }

        // Export overlay as transparent PNG
        const overlayBlobPromise = new Promise<Blob | null>((resolve) => {
          overlayCanvas.toBlob((b) => resolve(b), 'image/png');
        });
        const overlayBlob = await overlayBlobPromise;
        if (overlayBlob) {
          extraData.overlayBlob = overlayBlob;
        }
      }
    }

    // Unique publish path for video stories: avoid exporting the full canvas snapshot
    // (cross-origin video frames can make canvas export fail and block Done).
    if (isInitialVideo) {
      const placeholderCanvas = document.createElement('canvas');
      placeholderCanvas.width = 2;
      placeholderCanvas.height = 2;
      const placeholderCtx = placeholderCanvas.getContext('2d');
      if (placeholderCtx) {
        const grad = placeholderCtx.createLinearGradient(0, 0, 2, 2);
        grad.addColorStop(0, `hsl(${rootStyles2.getPropertyValue('--primary').trim()})`);
        grad.addColorStop(1, `hsl(${rootStyles2.getPropertyValue('--secondary').trim()})`);
        placeholderCtx.fillStyle = grad;
        placeholderCtx.fillRect(0, 0, 2, 2);
      }

      const placeholderBlob = await new Promise<Blob>((resolve) => {
        placeholderCanvas.toBlob(
          (b) => resolve(b ?? new Blob(['video-story'], { type: 'image/jpeg' })),
          'image/jpeg',
          0.8
        );
      });

      onDone(placeholderBlob, mentionedUserIds.length > 0 ? mentionedUserIds : undefined, extraData);
      return;
    }

    canvas.toBlob((blob) => {
      if (blob) onDone(blob, mentionedUserIds.length > 0 ? mentionedUserIds : undefined, extraData);
    }, 'image/jpeg', 0.92);
  };

  return { handleExport };
};
