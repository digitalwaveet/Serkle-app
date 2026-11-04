import { useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { ImageSticker } from './useStoryExport';
import { StickerItem } from '@/components/story/StoryStickerPicker';
import { TextOverlay } from '@/components/story/StoryTextOverlay';

const SNAP_THRESHOLD = 8;
const MIN_SCALE = 0.05;
const MAX_SCALE = 10;
const CANVAS_W = 390;
const CANVAS_H = 844;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(b.x - a.x, b.y - a.y);

const angle = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);

interface UseEditorGesturesProps {
  imageStickersRef: React.MutableRefObject<ImageSticker[]>;
  textOverlaysRef: React.MutableRefObject<TextOverlay[]>;
  emojiStickersRef: React.MutableRefObject<StickerItem[]>;
  setImageStickers: Dispatch<SetStateAction<ImageSticker[]>>;
  setTextOverlays: Dispatch<SetStateAction<TextOverlay[]>>;
  setEmojiStickers: Dispatch<SetStateAction<StickerItem[]>>;
  setSelectedImageId: (id: string | null) => void;
  setShowTrash: (show: boolean) => void;
  setDeletingId: (id: string | null) => void;
  setSnapV: (snap: boolean) => void;
  setSnapH: (snap: boolean) => void;
  setOverTrash: (over: boolean) => void;
  toCanvas: (cx: number, cy: number) => { x: number; y: number };
  isOverTrash: (clientY: number) => boolean;
}

export const useEditorGestures = ({
  imageStickersRef,
  textOverlaysRef,
  emojiStickersRef,
  setImageStickers,
  setTextOverlays,
  setEmojiStickers,
  setSelectedImageId,
  setShowTrash,
  setDeletingId,
  setSnapV,
  setSnapH,
  setOverTrash,
  toCanvas,
  isOverTrash,
}: UseEditorGesturesProps) => {
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const activeGesture = useRef<{
    type: 'image' | 'overlay';
    id: string;
    offsetX: number;
    offsetY: number;
    initDist: number;
    initAngle: number;
    initScale: number;
    initRotation: number;
    pid1: number;
    pid2: number;
  } | null>(null);

  const rafId = useRef<number>(0);
  const pendingMove = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  // ── IMAGE GESTURE HANDLERS ──
  const onImageDown = useCallback((e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    setSelectedImageId(id);
    setImageStickers(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1), prev[idx]];
    });
    setShowTrash(true);

    const img = imageStickersRef.current.find(s => s.id === id);
    if (!img) return;

    if (pointers.current.size === 1) {
      const pos = toCanvas(e.clientX, e.clientY);
      activeGesture.current = {
        type: 'image', id,
        offsetX: pos.x - img.x, offsetY: pos.y - img.y,
        initDist: 0, initAngle: 0, initScale: img.scale, initRotation: img.rotation,
        pid1: e.pointerId, pid2: -1,
      };
    } else if (pointers.current.size === 2) {
      const [p1, p2] = Array.from(pointers.current.entries());
      activeGesture.current = {
        type: 'image', id,
        offsetX: 0, offsetY: 0,
        initDist: dist(p1[1], p2[1]),
        initAngle: angle(p1[1], p2[1]),
        initScale: img.scale,
        initRotation: img.rotation,
        pid1: p1[0], pid2: p2[0],
      };
    }
  }, [toCanvas, setSelectedImageId, setImageStickers, setShowTrash, imageStickersRef]);

  const onImageMove = useCallback((e: React.PointerEvent) => {
    const g = activeGesture.current;
    if (!g || g.type !== 'image') return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    pendingMove.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0;
      const gesture = activeGesture.current;
      if (!gesture || gesture.type !== 'image') return;
      const pm = pendingMove.current;
      if (!pm) return;

      if (pointers.current.size === 1) {
        const pos = toCanvas(pm.x, pm.y);
        const newX = pos.x - gesture.offsetX;
        const newY = pos.y - gesture.offsetY;
        setImageStickers(prev => prev.map(s => s.id === gesture.id ? { ...s, x: newX, y: newY } : s));
        const midX = CANVAS_W / 2, midY = CANVAS_H / 2;
        setSnapV(Math.abs(newX - midX) < SNAP_THRESHOLD);
        setSnapH(Math.abs(newY - midY) < SNAP_THRESHOLD);
        setOverTrash(isOverTrash(pm.y));
      } else if (pointers.current.size >= 2) {
        const p1 = pointers.current.get(gesture.pid1);
        const p2 = pointers.current.get(gesture.pid2);
        if (!p1 || !p2) return;
        const curDist = dist(p1, p2);
        const curAngle = angle(p1, p2);
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, gesture.initScale * (curDist / gesture.initDist)));
        const newRotation = gesture.initRotation + (curAngle - gesture.initAngle);
        const midClient = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const midCanvas = toCanvas(midClient.x, midClient.y);
        setImageStickers(prev => prev.map(s => s.id === gesture.id ? { ...s, scale: newScale, rotation: newRotation, x: midCanvas.x, y: midCanvas.y } : s));
        setSnapV(false);
        setSnapH(false);
      }
    });
  }, [toCanvas, isOverTrash, setImageStickers, setSnapH, setSnapV, setOverTrash]);

  const onImageUp = useCallback((e: React.PointerEvent) => {
    const g = activeGesture.current;
    if (g && g.type !== 'image') return;

    pointers.current.delete(e.pointerId);

    if (pointers.current.size === 0) {
      if (g && g.type === 'image' && isOverTrash(e.clientY)) {
        setDeletingId(g.id);
        setTimeout(() => {
          setImageStickers(prev => prev.filter(s => s.id !== g.id));
          setDeletingId(null);
          setSelectedImageId(null);
        }, 200);
      }
      activeGesture.current = null;
      setSnapH(false); setSnapV(false);
      setOverTrash(false); setShowTrash(false);
    } else if (pointers.current.size === 1 && g) {
      const [remaining] = Array.from(pointers.current.entries());
      const img = imageStickersRef.current.find(s => s.id === g.id);
      if (img) {
        const pos = toCanvas(remaining[1].x, remaining[1].y);
        activeGesture.current = {
          ...g,
          offsetX: pos.x - img.x, offsetY: pos.y - img.y,
          pid1: remaining[0], pid2: -1,
          initDist: 0, initAngle: 0, initScale: img.scale, initRotation: img.rotation,
        };
      }
    }
  }, [toCanvas, isOverTrash, imageStickersRef, setDeletingId, setImageStickers, setSelectedImageId, setSnapH, setSnapV, setOverTrash, setShowTrash]);

  // ── OVERLAY GESTURE HANDLERS ──
  const onOverlayDown = useCallback((e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const pos = toCanvas(e.clientX, e.clientY);
    const text = textOverlaysRef.current.find(t => t.id === id);
    const sticker = emojiStickersRef.current.find(s => s.id === id);
    const itemX = text ? (text.x / 100) * CANVAS_W : sticker ? (sticker.x / 100) * CANVAS_W : 0;
    const itemY = text ? (text.y / 100) * CANVAS_H : sticker ? (sticker.y / 100) * CANVAS_H : 0;

    activeGesture.current = {
      type: 'overlay', id,
      offsetX: pos.x - itemX, offsetY: pos.y - itemY,
      initDist: 0, initAngle: 0, initScale: 1, initRotation: 0,
      pid1: e.pointerId, pid2: -1,
    };
    setShowTrash(true);
  }, [toCanvas, textOverlaysRef, emojiStickersRef, setShowTrash]);

  const onOverlayMove = useCallback((e: React.PointerEvent) => {
    const g = activeGesture.current;
    if (!g || g.type !== 'overlay') return;

    if (rafId.current) cancelAnimationFrame(rafId.current);
    const cx = e.clientX, cy = e.clientY;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0;
      const gesture = activeGesture.current;
      if (!gesture || gesture.type !== 'overlay') return;

      const pos = toCanvas(cx, cy);
      const newX = Math.max(0, Math.min(100, ((pos.x - gesture.offsetX) / CANVAS_W) * 100));
      const newY = Math.max(0, Math.min(100, ((pos.y - gesture.offsetY) / CANVAS_H) * 100));

      setTextOverlays(prev => prev.map(t => t.id === gesture.id ? { ...t, x: newX, y: newY } : t));
      setEmojiStickers(prev => prev.map(s => s.id === gesture.id ? { ...s, x: newX, y: newY } : s));

      const absX = (newX / 100) * CANVAS_W, absY = (newY / 100) * CANVAS_H;
      setSnapV(Math.abs(absX - CANVAS_W / 2) < SNAP_THRESHOLD);
      setSnapH(Math.abs(absY - CANVAS_H / 2) < SNAP_THRESHOLD);
      setOverTrash(isOverTrash(cy));
    });
  }, [toCanvas, isOverTrash, setTextOverlays, setEmojiStickers, setSnapH, setSnapV, setOverTrash]);

  const onOverlayUp = useCallback((e: React.PointerEvent) => {
    const g = activeGesture.current;
    if (!g || g.type !== 'overlay') return;

    if (isOverTrash(e.clientY)) {
      setDeletingId(g.id);
      setTimeout(() => {
        setTextOverlays(prev => prev.filter(t => t.id !== g.id));
        setEmojiStickers(prev => prev.filter(s => s.id !== g.id));
        setDeletingId(null);
      }, 200);
    }
    activeGesture.current = null;
    setSnapH(false); setSnapV(false);
    setOverTrash(false); setShowTrash(false);
  }, [isOverTrash, setDeletingId, setTextOverlays, setEmojiStickers, setSnapH, setSnapV, setOverTrash, setShowTrash]);

  const onGlobalPointerMove = useCallback((e: React.PointerEvent) => {
    const g = activeGesture.current;
    if (!g) return;
    if (g.type === 'overlay') onOverlayMove(e);
  }, [onOverlayMove]);

  const onGlobalPointerUp = useCallback((e: React.PointerEvent) => {
    const g = activeGesture.current;
    if (!g) return;
    if (g.type === 'overlay') onOverlayUp(e);
  }, [onOverlayUp]);

  return {
    onImageDown,
    onImageMove,
    onImageUp,
    onOverlayDown,
    onGlobalPointerMove,
    onGlobalPointerUp,
  };
};
