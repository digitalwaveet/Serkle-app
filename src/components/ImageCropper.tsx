import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { Area } from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, RefreshCw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

// Generate a flipped version of the image via canvas
const createFlippedImage = (src: string, flipH: boolean, flipV: boolean): Promise<string> => {
  return new Promise((resolve) => {
    if (!flipH && !flipV) { resolve(src); return; }
    const img = new Image();
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(flipH ? img.width : 0, flipV ? img.height : 0);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
};

interface ImageCropperProps {
  imageSrc: string;
  /** Numeric ratio (e.g. 1, 16/9), `null` to open directly in Free crop mode, or omit to default to 1:1. */
  aspectRatio?: number | null;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  cropShape?: 'rect' | 'round';
  dimensionLabel?: string;
  /** Render inside the parent dialog/container instead of portaling to document.body. */
  inline?: boolean;
}

const createCroppedImage = async (
  imageSrc: string,
  pixelCrop: Area,
  rotation: number,
  flipH: boolean,
  flipV: boolean
): Promise<Blob> => {
  const image = new Image();
  if (/^https?:/i.test(imageSrc)) image.crossOrigin = 'anonymous';

  return new Promise((resolve, reject) => {
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }

      const radians = (rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(radians));
      const cos = Math.abs(Math.cos(radians));

      const bBoxWidth = image.width * cos + image.height * sin;
      const bBoxHeight = image.width * sin + image.height * cos;

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = bBoxWidth;
      tempCanvas.height = bBoxHeight;
      const tempCtx = tempCanvas.getContext('2d')!;

      tempCtx.translate(bBoxWidth / 2, bBoxHeight / 2);
      tempCtx.rotate(radians);
      tempCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      tempCtx.translate(-image.width / 2, -image.height / 2);
      tempCtx.drawImage(image, 0, 0);

      ctx.drawImage(
        tempCanvas,
        pixelCrop.x, pixelCrop.y,
        pixelCrop.width, pixelCrop.height,
        0, 0,
        pixelCrop.width, pixelCrop.height
      );

      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error('Blob failed')); },
        'image/jpeg',
        0.92
      );
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
};

const ASPECT_PRESETS = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
];

const clampNum = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

interface FreeCropAreaProps {
  /** Image whose pixels the crop maps to (flips already baked in). */
  image: string;
  onCropPixels: (area: Area | null) => void;
}

// Resize handles: corners (L-brackets) + edge midpoints (bars), each with a 36px touch target.
const FREE_HANDLES: { key: string; mode: string; pos: string; visual: string; label: string }[] = [
  { key: 'nw', mode: 'nw', pos: '-left-4 -top-4 cursor-nwse-resize', visual: 'w-5 h-5 border-t-[3px] border-l-[3px] border-white rounded-tl-[2px] translate-x-[6px] translate-y-[6px]', label: 'Resize top-left corner' },
  { key: 'n', mode: 'n', pos: 'left-1/2 -top-4 -translate-x-1/2 cursor-ns-resize', visual: 'w-7 h-1.5 rounded-full bg-white shadow', label: 'Resize top edge' },
  { key: 'ne', mode: 'ne', pos: '-right-4 -top-4 cursor-nesw-resize', visual: 'w-5 h-5 border-t-[3px] border-r-[3px] border-white rounded-tr-[2px] -translate-x-[6px] translate-y-[6px]', label: 'Resize top-right corner' },
  { key: 'e', mode: 'e', pos: '-right-4 top-1/2 -translate-y-1/2 cursor-ew-resize', visual: 'w-1.5 h-7 rounded-full bg-white shadow', label: 'Resize right edge' },
  { key: 'se', mode: 'se', pos: '-right-4 -bottom-4 cursor-nwse-resize', visual: 'w-5 h-5 border-b-[3px] border-r-[3px] border-white rounded-br-[2px] -translate-x-[6px] -translate-y-[6px]', label: 'Resize bottom-right corner' },
  { key: 's', mode: 's', pos: 'left-1/2 -bottom-4 -translate-x-1/2 cursor-ns-resize', visual: 'w-7 h-1.5 rounded-full bg-white shadow', label: 'Resize bottom edge' },
  { key: 'sw', mode: 'sw', pos: '-left-4 -bottom-4 cursor-nesw-resize', visual: 'w-5 h-5 border-b-[3px] border-l-[3px] border-white rounded-bl-[2px] translate-x-[6px] -translate-y-[6px]', label: 'Resize bottom-left corner' },
  { key: 'w', mode: 'w', pos: '-left-4 top-1/2 -translate-y-1/2 cursor-ew-resize', visual: 'w-1.5 h-7 rounded-full bg-white shadow', label: 'Resize left edge' },
];

const MIN_BOX = 44; // px
const FRAME_PAD = 18; // px breathing room so handles are never clipped at container edges

/**
 * Free-form cropper: the image is shown fit-to-view and the user drags any edge
 * or corner (or the interior to move) to select an arbitrary rectangle. The crop
 * is exactly the selected region — no aspect ratio is enforced.
 */
const FreeCropArea: React.FC<FreeCropAreaProps> = ({ image, onCropPixels }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [layout, setLayout] = useState<{
    offsetX: number; offsetY: number; dispW: number; dispH: number; scale: number;
  } | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragRef = useRef<{ mode: string; startX: number; startY: number; orig: { x: number; y: number; w: number; h: number } } | null>(null);

  // Compute the displayed (object-contain) image rect and reset the box to full.
  const computeLayout = useCallback(() => {
    const c = containerRef.current;
    const im = imgRef.current;
    if (!c || !im || !im.naturalWidth || !im.naturalHeight) return;
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const availW = Math.max(1, cw - FRAME_PAD * 2);
    const availH = Math.max(1, ch - FRAME_PAD * 2);
    const scale = Math.min(availW / im.naturalWidth, availH / im.naturalHeight);
    const dispW = im.naturalWidth * scale;
    const dispH = im.naturalHeight * scale;
    const offsetX = (cw - dispW) / 2;
    const offsetY = (ch - dispH) / 2;
    setLayout({ offsetX, offsetY, dispW, dispH, scale });
    setBox({ x: offsetX, y: offsetY, w: dispW, h: dispH });
  }, []);

  useEffect(() => { computeLayout(); }, [computeLayout, image]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(computeLayout);
    ro.observe(c);
    return () => ro.disconnect();
  }, [computeLayout]);

  // Report the selected region in source-image pixels whenever it changes.
  useEffect(() => {
    const im = imgRef.current;
    if (!box || !layout || !im || !im.naturalWidth || !im.naturalHeight) {
      onCropPixels(null);
      return;
    }
    const x = clampNum(Math.round((box.x - layout.offsetX) / layout.scale), 0, im.naturalWidth - 1);
    const y = clampNum(Math.round((box.y - layout.offsetY) / layout.scale), 0, im.naturalHeight - 1);
    const width = clampNum(Math.round(box.w / layout.scale), 1, im.naturalWidth - x);
    const height = clampNum(Math.round(box.h / layout.scale), 1, im.naturalHeight - y);
    onCropPixels({ x, y, width, height });
  }, [box, layout, onCropPixels]);

  const beginDrag = (mode: string) => (e: React.PointerEvent) => {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...box } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !layout) return;
    e.preventDefault();
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const o = d.orig;
    const minX = layout.offsetX;
    const minY = layout.offsetY;
    const maxX = layout.offsetX + layout.dispW;
    const maxY = layout.offsetY + layout.dispH;
    const minW = Math.min(MIN_BOX, layout.dispW);
    const minH = Math.min(MIN_BOX, layout.dispH);

    if (d.mode === 'move') {
      setBox({
        x: clampNum(o.x + dx, minX, maxX - o.w),
        y: clampNum(o.y + dy, minY, maxY - o.h),
        w: o.w,
        h: o.h,
      });
      return;
    }

    let { x, y, w, h } = o;
    if (d.mode.includes('e')) w = clampNum(o.w + dx, minW, maxX - o.x);
    if (d.mode.includes('s')) h = clampNum(o.h + dy, minH, maxY - o.y);
    if (d.mode.includes('w')) {
      const right = o.x + o.w;
      x = clampNum(o.x + dx, minX, right - minW);
      w = right - x;
    }
    if (d.mode.includes('n')) {
      const bottom = o.y + o.h;
      y = clampNum(o.y + dy, minY, bottom - minH);
      h = bottom - y;
    }
    setBox({ x, y, w, h });
  };

  const endDrag = () => { dragRef.current = null; };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden touch-none"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img
        ref={imgRef}
        src={image}
        alt=""
        draggable={false}
        onLoad={computeLayout}
        style={layout ? { left: layout.offsetX, top: layout.offsetY, width: layout.dispW, height: layout.dispH } : undefined}
        className={`absolute pointer-events-none select-none ${layout ? '' : 'inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] object-contain'}`}
      />

      {box && layout && (
        <div
          className="absolute border-2 border-white touch-none"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h, boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)', cursor: 'move' }}
          onPointerDown={beginDrag('move')}
        >
          {/* Rule-of-thirds crop grid */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 inset-x-0 h-px bg-white/40" />
            <div className="absolute top-2/3 inset-x-0 h-px bg-white/40" />
            <div className="absolute left-1/3 inset-y-0 w-px bg-white/40" />
            <div className="absolute left-2/3 inset-y-0 w-px bg-white/40" />
          </div>

          {/* Corner & edge resize handles */}
          {FREE_HANDLES.map((hdl) => (
            <div
              key={hdl.key}
              aria-label={hdl.label}
              onPointerDown={beginDrag(hdl.mode)}
              className={`absolute w-9 h-9 flex items-center justify-center touch-none ${hdl.pos}`}
            >
              <span className={`pointer-events-none block ${hdl.visual}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ImageCropper: React.FC<ImageCropperProps> = ({
  imageSrc,
  aspectRatio: initialAspect = 1,
  onCropComplete,
  onCancel,
  cropShape = 'rect',
  dimensionLabel,
  inline = false,
}) => {
  const defaultAspect = initialAspect === null ? undefined : initialAspect;
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [aspect, setAspect] = useState<number | undefined>(defaultAspect);
  const [activeControl, setActiveControl] = useState<'zoom' | 'rotate'>('zoom');
  const [flippedSrc, setFlippedSrc] = useState<string>(imageSrc);
  const [freeResetKey, setFreeResetKey] = useState(0);

  const isFree = aspect === undefined;

  // Re-generate flipped image whenever flip state changes
  useEffect(() => {
    let cancelled = false;
    createFlippedImage(imageSrc, flipH, flipV).then((src) => {
      if (!cancelled) setFlippedSrc(src);
    });
    return () => { cancelled = true; };
  }, [imageSrc, flipH, flipV]);

  const onCropChange = useCallback((c: { x: number; y: number }) => setCrop(c), []);
  const onZoomChange = useCallback((z: number) => setZoom(z), []);

  const handleCropDone = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsSaving(true);
    try {
      // Free mode crops the displayed (un-rotated) image directly, so don't
      // re-apply rotation when baking the output.
      const effectiveRotation = isFree ? 0 : rotation;
      const croppedBlob = await createCroppedImage(flippedSrc, croppedAreaPixels, effectiveRotation, false, false);
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setAspect(defaultAspect);
    setFreeResetKey((k) => k + 1); // reset the free-crop box to the full image
  };

  const getDimensionHint = () => {
    if (dimensionLabel) return dimensionLabel;
    if (cropShape === 'round') return '400×400px (1:1)';
    if (aspect === 16 / 9) return '1200×675px (16:9)';
    if (aspect === 9 / 16) return '1080×1920px (9:16)';
    if (aspect === 1) return '400×400px (1:1)';
    return 'Free transform';
  };

  // Prevent any click/mouse events from reaching elements behind the overlay
  const stopAll = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  const content = (
    <div
      data-editor-controls={inline ? '' : undefined}
      className={`${inline ? 'absolute inset-0 z-[160]' : 'fixed inset-0 z-[200]'} bg-black/95 flex flex-col select-none`}
      role="dialog"
      aria-modal={!inline}
      aria-labelledby="image-editor-title"
      aria-busy={isSaving}
      onClick={stopAll}
      onMouseDown={stopAll}
      onTouchStart={stopAll as any}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] z-10 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel photo editing"
          className="h-10 w-10 rounded-full bg-card/10 hover:bg-card/20 active:bg-card/30 border border-white/10 flex items-center justify-center transition-all"
        >
          <X className="h-5 w-5 text-white/90" />
        </button>
        <div className="text-center">
          <h2 id="image-editor-title" className="text-white font-semibold text-base tracking-tight">Edit Photo</h2>
          <p className="text-secondary text-[11px] font-medium mt-0.5">{getDimensionHint()}</p>
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isSaving}
          aria-label={isSaving ? 'Saving edited photo' : 'Save edited photo'}
          className="h-10 w-10 rounded-full bg-secondary hover:bg-secondary/90 active:bg-secondary/80 flex items-center justify-center transition-all disabled:opacity-50 shadow-lg shadow-secondary/30"
        >
          <Check className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      {/* Cropper Area */}
      <div className="flex-1 relative min-h-0">
        {isFree && cropShape === 'rect' ? (
          <FreeCropArea
            key={`free-${freeResetKey}`}
            image={flippedSrc}
            onCropPixels={setCroppedAreaPixels}
          />
        ) : (
          <Cropper
            image={flippedSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            cropShape={cropShape}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={handleCropDone}
            showGrid={true}
            minZoom={0.5}
            maxZoom={5}
            style={{
              containerStyle: { background: 'rgba(0,0,0,0.95)' },
            }}
            classes={{
              containerClassName: 'rounded-none',
            }}
          />
        )}
      </div>

      {/* Bottom Controls */}
      <div className="shrink-0 bg-gradient-to-t from-black via-black/95 to-black/80 pb-safe">
        {/* Aspect Ratio Pills */}
        {cropShape === 'rect' && (
          <div className="flex items-center justify-center gap-2 px-4 pt-3 pb-2">
            {ASPECT_PRESETS.map((preset) => {
              const isActive = preset.value === aspect || (preset.value === undefined && aspect === undefined);
              return (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => setAspect(preset.value)}
                  aria-pressed={isActive}
                  aria-label={`Crop ratio ${preset.label}`}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-secondary text-secondary-foreground shadow-lg shadow-secondary/30'
                      : 'bg-card/8 text-white/60 hover:bg-card/15 hover:text-white/80 active:bg-card/20'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Free-mode hint */}
        {isFree && cropShape === 'rect' && (
          <p className="text-center text-white/50 text-[11px] font-medium px-4 pt-1 pb-3">
            Drag the corners or edges to crop freely
          </p>
        )}

        {/* Zoom / Rotate controls (not applicable in Free mode) */}
        {!(isFree && cropShape === 'rect') && (
        <>
        {/* Tab Switcher */}
        <div className="flex items-center justify-center gap-1 px-4 pt-1 pb-2">
          <button
            type="button"
            onClick={() => setActiveControl('zoom')}
            aria-pressed={activeControl === 'zoom'}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeControl === 'zoom'
                ? 'bg-card/15 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Zoom
          </button>
          <button
            type="button"
            onClick={() => setActiveControl('rotate')}
            aria-pressed={activeControl === 'rotate'}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeControl === 'rotate'
                ? 'bg-card/15 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Rotate
          </button>
        </div>

        {/* Slider Area */}
        <div className="px-6 pb-2">
          {activeControl === 'zoom' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
                aria-label="Zoom out"
                className="h-8 w-8 rounded-full bg-card/8 hover:bg-card/15 active:bg-card/20 flex items-center justify-center transition-all"
              >
                <ZoomOut className="h-3.5 w-3.5 text-white/70" />
              </button>
              <div className="flex-1">
                <Slider
                  value={[zoom]}
                  min={0.5}
                  max={5}
                  step={0.05}
                  onValueChange={(val) => setZoom(val[0])}
                  aria-label="Photo zoom"
                  className="[&_[role=slider]]:bg-secondary [&_[role=slider]]:border-secondary [&_[role=slider]]:shadow-lg [&_[role=slider]]:shadow-secondary/30 [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&>span:first-child]:bg-card/15 [&>span:first-child>span]:bg-secondary"
                />
              </div>
              <button
                type="button"
                onClick={() => setZoom(Math.min(5, zoom + 0.2))}
                aria-label="Zoom in"
                className="h-8 w-8 rounded-full bg-card/8 hover:bg-card/15 active:bg-card/20 flex items-center justify-center transition-all"
              >
                <ZoomIn className="h-3.5 w-3.5 text-white/70" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRotation(r => r - 15)}
                aria-label="Rotate left 15 degrees"
                className="h-8 w-8 rounded-full bg-card/8 hover:bg-card/15 active:bg-card/20 flex items-center justify-center transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5 text-white/70" />
              </button>
              <div className="flex-1">
                <Slider
                  value={[rotation]}
                  min={-180}
                  max={180}
                  step={1}
                  onValueChange={(val) => setRotation(val[0])}
                  aria-label="Photo rotation"
                  className="[&_[role=slider]]:bg-secondary [&_[role=slider]]:border-secondary [&_[role=slider]]:shadow-lg [&_[role=slider]]:shadow-secondary/30 [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&>span:first-child]:bg-card/15 [&>span:first-child>span]:bg-secondary"
                />
              </div>
              <button
                type="button"
                onClick={() => setRotation(r => r + 15)}
                aria-label="Rotate right 15 degrees"
                className="h-8 w-8 rounded-full bg-card/8 hover:bg-card/15 active:bg-card/20 flex items-center justify-center transition-all"
              >
                <RotateCw className="h-3.5 w-3.5 text-white/70" />
              </button>
            </div>
          )}
        </div>
        </>
        )}

        {/* Quick Actions */}
        <div className="flex items-center justify-center gap-3 px-4 pt-1 pb-4">
          <button
            type="button"
            onClick={() => setFlipH(f => !f)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
              flipH ? 'bg-secondary/20 text-secondary' : 'text-white/50 hover:text-white/70 active:bg-card/10'
            }`}
          >
            <FlipHorizontal className="h-4 w-4" />
            <span className="text-[10px] font-medium">Flip H</span>
          </button>
          <button
            type="button"
            onClick={() => setFlipV(f => !f)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
              flipV ? 'bg-secondary/20 text-secondary' : 'text-white/50 hover:text-white/70 active:bg-card/10'
            }`}
          >
            <FlipVertical className="h-4 w-4" />
            <span className="text-[10px] font-medium">Flip V</span>
          </button>
          {!(isFree && cropShape === 'rect') && (
            <button
              type="button"
              onClick={() => setRotation(r => (r + 90) % 360)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-white/50 hover:text-white/70 active:bg-card/10 transition-all"
            >
              <RotateCw className="h-4 w-4" />
              <span className="text-[10px] font-medium">90°</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-white/50 hover:text-white/70 active:bg-card/10 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="text-[10px] font-medium">Reset</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (inline) return content;

  // Render via portal to escape parent form/label DOM context
  return createPortal(content, document.body);
};

export default ImageCropper;
