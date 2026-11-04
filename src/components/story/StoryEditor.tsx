import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Type, Sticker, Sparkles, PenTool, Trash2, Eye, ChevronRight, Image as ImageIcon, Undo2, Crop } from 'lucide-react';
import { StoryState, StoryElement, DrawingPath, EditorExtraData } from '@/types/storyTypes';
import { StoryCanvas, CANVAS_W, CANVAS_H } from './StoryCanvas';
import { StoryDrawingOverlay } from './StoryDrawingOverlay';
import StoryTextOverlay from './StoryTextOverlay';
import StoryStickerPicker from './StoryStickerPicker';
import StoryFilterPicker from './StoryFilterPicker';
import { StoryDialog } from './StoryDialog';
import { inspectStoryFile, validateStoryFile } from '@/lib/storyMedia';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

interface Props {
  previewUrl: string;
  mediaType?: 'image' | 'video';
  startWithText?: boolean;
  initialPostElements?: { postCardImageUrl?: string };
  resharedPostId?: string;
  onDone: (editedImageBlob: Blob, mentionedUserIds?: string[], extraData?: EditorExtraData) => Promise<void> | void;
  onCancel: () => void;
}

export function StoryEditor({ previewUrl, mediaType = 'image', startWithText = false, initialPostElements, resharedPostId, onDone, onCancel }: Props) {
  const [state, setState] = useState<StoryState>({
    background: { type: mediaType, value: previewUrl, x: 50, y: 50, scale: 1, rotation: 0 },
    elements: [],
    drawingPaths: []
  });

  const [activeTool, setActiveTool] = useState<'text' | 'sticker' | 'filter' | 'draw' | null>(startWithText ? 'text' : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLayerControls, setShowLayerControls] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [editingText, setEditingText] = useState<StoryElement | null>(null);
  const publicationId = useRef(crypto.randomUUID());
  const publishing = useRef(false);
  const stickerUrls = useRef<string[]>([]);
  useEffect(() => () => stickerUrls.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);
  const requestClose = () => {
    if (publishing.current) return;
    if (activeTool) { setActiveTool(null); return; }
    if (isPreviewMode) { setIsPreviewMode(false); return; }
    setConfirmDiscard(true);
  };
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Canvas interaction refs
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Undo stack
  const [undoStack, setUndoStack] = useState<StoryState[]>([]);

  const pushUndo = useCallback((snapshot?: StoryState) => {
    const toPush = snapshot || stateRef.current;
    setUndoStack(prev => [...prev.slice(-14), toPush]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setState(last);
      setSelectedId(null);
      return prev.slice(0, -1);
    });
  }, []);

  // Multi-touch gesture tracking
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureStateRef = useRef<{
    id: string;
    elStartX: number;
    elStartY: number;
    elStartScale: number;
    elStartRot: number;
    gestureStartDist: number | null;
    gestureStartAngle: number | null;
    gestureStartCenter: { x: number; y: number } | null;
  } | null>(null);

  // Mirrors of state/flags so pointer handlers read fresh values without re-binding
  const selectedIdRef = useRef<string | null>(null);
  const isOverTrashRef = useRef(false);
  const gestureMovedRef = useRef(false);      // did the active gesture move past the tap threshold?
  const usedSecondFingerRef = useRef(false);  // did a 2nd finger join this gesture?
  const downHitOverlayRef = useRef<string | null>(null); // overlay id the first finger landed on (null = empty)
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { isOverTrashRef.current = isOverTrash; }, [isOverTrash]);

  // Build the pseudo-element used to drive background gestures
  const backgroundElement = useCallback((): StoryElement => ({
    id: 'background',
    type: stateRef.current.background.type as any,
    content: '',
    x: stateRef.current.background.x ?? 50,
    y: stateRef.current.background.y ?? 50,
    scale: stateRef.current.background.scale ?? 1,
    rotation: stateRef.current.background.rotation ?? 0,
    zIndex: -1,
  }), []);

  // File manager for image stickers
  const photoInput = useRef<HTMLInputElement>(null);

  // Initialize elements
  useEffect(() => {
    if (initialPostElements?.postCardImageUrl && state.elements.length === 0) {
      setState(prev => ({
        ...prev,
        elements: [{
          id: 'post-card',
          type: 'image',
          content: initialPostElements.postCardImageUrl,
          x: 50, y: 50, scale: 1, rotation: 0, zIndex: 1
        }]
      }));
    }
  }, [initialPostElements]);

  // Detect media aspect ratio and set objectFit mode
  useEffect(() => {
    if (!previewUrl) return;

    const canvasRatio = CANVAS_W / CANVAS_H; // 9:16 = 0.5625
    const tolerance = 0.08; // ~8% tolerance

    const updateState = (width: number, height: number) => {
      const mediaRatio = width / height;
      const needsContain = Math.abs(mediaRatio - canvasRatio) > tolerance;

      setState(prev => ({
        ...prev,
        background: {
          ...prev.background,
          mediaWidth: width,
          mediaHeight: height,
          objectFit: needsContain ? 'contain' : 'cover',
        }
      }));
    };

    if (mediaType === 'image') {
      const img = new Image();
      img.onload = () => updateState(img.width, img.height);
      img.src = previewUrl;
    } else if (mediaType === 'video') {
      const video = document.createElement('video');
      video.onloadedmetadata = () => updateState(video.videoWidth, video.videoHeight);
      video.src = previewUrl;
      video.load();
    }
  }, [previewUrl, mediaType]);

  // Recalculate the gesture baseline from the current pointer positions and element state
  const updateGestureBaseline = useCallback((el: StoryElement) => {
    const pts = Array.from(pointersRef.current.values());
    let dist = null;
    let angle = null;
    let center = null;

    if (pts.length === 1) {
      center = { x: pts[0].x, y: pts[0].y };
    } else if (pts.length >= 2) {
      const p1 = pts[0];
      const p2 = pts[1];
      dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
      center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }

    gestureStateRef.current = {
      id: el.id,
      elStartX: el.x,
      elStartY: el.y,
      elStartScale: el.scale,
      elStartRot: el.rotation,
      gestureStartDist: dist,
      gestureStartAngle: angle,
      gestureStartCenter: center
    };
  }, []);

  // Hit test against the ACTUAL rendered bounds of each overlay element.
  // Returns the top-most overlay under the point, or null when the point is on
  // empty canvas / background.
  const hitTestElement = useCallback((clientX: number, clientY: number): StoryElement | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Top-most z-index first so stacked overlays resolve correctly.
    const sorted = [...stateRef.current.elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    const pad = 10; // px of slack to make small stickers easier to grab

    for (const el of sorted) {
      const node = canvas.querySelector(`[data-el-id="${el.id}"]`) as HTMLElement | null;
      if (!node) continue;
      const r = node.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (
        clientX >= r.left - pad && clientX <= r.right + pad &&
        clientY >= r.top - pad && clientY <= r.bottom + pad
      ) {
        return el;
      }
    }

    // No overlay hit → background.
    return null;
  }, []);

  // ─── Pointer handlers (all at canvas level for reliable multi-touch) ───

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isPreviewMode || activeTool) return;

    // Don't interfere with UI buttons / toolbars
    if ((e.target as HTMLElement).closest('[data-editor-controls]')) return;

    e.preventDefault();
    // Capture so the whole gesture (incl. dragging over the bottom toolbar to the
    // trash zone) keeps delivering pointer events to the canvas.
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      gestureMovedRef.current = false;
      usedSecondFingerRef.current = false;

      const hitEl = hitTestElement(e.clientX, e.clientY); // overlay | null
      downHitOverlayRef.current = hitEl ? hitEl.id : null;

      if (hitEl) {
        // Touched an overlay → select it and manipulate it.
        setSelectedId(hitEl.id);
        selectedIdRef.current = hitEl.id;
        setIsDragging(true);
        updateGestureBaseline(hitEl);
      } else {
        // Touched empty space → a single finger drives the background (pan).
        // Selection is kept for now; a plain tap here de-selects on pointer up,
        // and a 2nd finger (pinch) re-targets the selected overlay below.
        updateGestureBaseline(backgroundElement());
      }
    } else if (pointersRef.current.size >= 2) {
      // Second finger joins → this is a pinch/rotate.
      usedSecondFingerRef.current = true;

      // The subject is the current selection: selected overlay, else background.
      const selId = selectedIdRef.current;
      const target = selId
        ? stateRef.current.elements.find(el => el.id === selId) ?? null
        : null;

      if (target) {
        setIsDragging(true);
        updateGestureBaseline(target);
      } else {
        updateGestureBaseline(backgroundElement());
      }
    }
  }, [isPreviewMode, activeTool, hitTestElement, updateGestureBaseline, backgroundElement]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isPreviewMode || !gestureStateRef.current) return;
    if (!pointersRef.current.has(e.pointerId)) return;
    
    e.preventDefault();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    const pts = Array.from(pointersRef.current.values());
    const g = gestureStateRef.current;

    // Mark the gesture as a real move (vs. a tap) once it travels past a threshold.
    if (g.gestureStartCenter) {
      const moved = Math.hypot(pts[0].x - g.gestureStartCenter.x, pts[0].y - g.gestureStartCenter.y);
      if (moved > 6) {
        if (!gestureMovedRef.current) {
          pushUndo(stateRef.current);
        }
        gestureMovedRef.current = true;
      }
    }

    if (!canvasRef.current) return;
    const rect = (canvasRef.current.querySelector('.story-canvas-inner') || canvasRef.current).getBoundingClientRect();

    let newX = g.elStartX;
    let newY = g.elStartY;
    let newScale = g.elStartScale;
    let newRot = g.elStartRot;
    
    if (pts.length === 1 && g.gestureStartCenter) {
      // Single finger drag
      const dx = pts[0].x - g.gestureStartCenter.x;
      const dy = pts[0].y - g.gestureStartCenter.y;
      newX = g.elStartX + (dx / rect.width) * 100;
      newY = g.elStartY + (dy / rect.height) * 100;
    } 
    else if (pts.length >= 2 && g.gestureStartDist !== null && g.gestureStartAngle !== null && g.gestureStartCenter) {
      // Multi-finger: pinch + rotate + drag
      const p1 = pts[0];
      const p2 = pts[1];
      
      const curDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const curAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
      const curCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      
      // Scale
      const scaleDelta = curDist / (g.gestureStartDist || 1);
      newScale = Math.max(0.1, Math.min(5, g.elStartScale * scaleDelta));
      
      // Rotation
      const angleDelta = curAngle - g.gestureStartAngle;
      newRot = g.elStartRot + angleDelta;
      
      // Pan (from center movement)
      const dx = curCenter.x - g.gestureStartCenter.x;
      const dy = curCenter.y - g.gestureStartCenter.y;
      newX = g.elStartX + (dx / rect.width) * 100;
      newY = g.elStartY + (dy / rect.height) * 100;
    }
    
    setState(prev => {
      if (g.id === 'background') {
        return {
          ...prev,
          background: {
            ...prev.background,
            x: newX,
            y: newY,
            scale: newScale,
            rotation: newRot
          }
        };
      } else {
        return {
          ...prev,
          elements: prev.elements.map(el => 
            el.id === g.id ? { ...el, x: newX, y: newY, scale: newScale, rotation: newRot } : el
          )
        };
      }
    });
    
    // Trash only applies to overlay elements (the background can't be deleted).
    const overlayTarget = g.id !== 'background';
    const maxY = Math.max(...pts.map(p => p.y));
    const over = overlayTarget && maxY > window.innerHeight - 100;
    isOverTrashRef.current = over;
    setIsOverTrash(over);
  }, [isPreviewMode]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;

    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    pointersRef.current.delete(e.pointerId);

    const g = gestureStateRef.current;

    // Dropped an overlay onto the trash zone → delete it.
    if (isOverTrashRef.current && g && g.id !== 'background') {
      const id = g.id;
      setState(prev => ({ ...prev, elements: prev.elements.filter(el => el.id !== id) }));
      setSelectedId(null);
      selectedIdRef.current = null;
      gestureStateRef.current = null;
      pointersRef.current.clear();
      setIsDragging(false);
      setIsOverTrash(false);
      isOverTrashRef.current = false;
      return;
    }

    if (pointersRef.current.size > 0 && g) {
      // A finger lifted but others remain → re-baseline for a smooth transition.
      const el = g.id === 'background'
        ? backgroundElement()
        : stateRef.current.elements.find(el => el.id === g.id);
      if (el) updateGestureBaseline(el);
      return;
    }

    // All fingers lifted.
    if (!gestureMovedRef.current && !usedSecondFingerRef.current) {
      // It was a tap: on an overlay → keep it selected; on empty → de-select.
      if (downHitOverlayRef.current) {
        setSelectedId(downHitOverlayRef.current);
        selectedIdRef.current = downHitOverlayRef.current;
      } else {
        setSelectedId(null);
        selectedIdRef.current = null;
      }
    }

    gestureStateRef.current = null;
    setIsDragging(false);
    setIsOverTrash(false);
    isOverTrashRef.current = false;
  }, [updateGestureBaseline, backgroundElement]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
      gestureStateRef.current = null;
      setIsDragging(false);
      setIsOverTrash(false);
      isOverTrashRef.current = false;
    }
  }, []);

  // Prevent default touch behaviors on the editor container
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    
    const preventTouch = (e: TouchEvent) => {
      // Only prevent when we have an active gesture or more than 1 touch
      if (gestureStateRef.current || e.touches.length > 1) {
        e.preventDefault();
      }
    };
    
    el.addEventListener('touchstart', preventTouch, { passive: false });
    el.addEventListener('touchmove', preventTouch, { passive: false });
    
    return () => {
      el.removeEventListener('touchstart', preventTouch);
      el.removeEventListener('touchmove', preventTouch);
    };
  }, []);

  const handleAddText = (overlay: any) => {
    pushUndo();
    const newElement: StoryElement = {
      id: editingText?.id || crypto.randomUUID(),
      type: 'text',
      content: overlay.text,
      x: editingText?.x ?? overlay.x, y: editingText?.y ?? overlay.y,
      scale: editingText?.scale ?? 1, rotation: editingText?.rotation ?? 0, zIndex: editingText?.zIndex ?? Date.now(),
      fontSize: overlay.fontSize,
      fontFamily: overlay.fontFamily,
      fontWeight: overlay.fontWeight,
      fontStyle: overlay.fontStyle,
      textAlign: overlay.textAlign,
      color: overlay.color,
      bgColor: overlay.bgColor
    };
    setState(prev => ({ ...prev, elements: editingText ? prev.elements.map(el => el.id === editingText.id ? newElement : el) : [...prev.elements, newElement] }));
    setEditingText(null);
    setSelectedId(newElement.id);
    selectedIdRef.current = newElement.id;
    setActiveTool(null);
  };

  const handleAddSticker = (sticker: any) => {
    pushUndo();
    const newElement: StoryElement = {
      id: Math.random().toString(36).substr(2, 9),
      type: sticker.type === 'emoji' ? 'emoji' : 'info',
      content: sticker.content,
      infoType: sticker.infoType,
      mentionUserId: sticker.mentionUserId,
      x: 50, y: 50, scale: 1, rotation: 0, zIndex: Date.now()
    };
    setState(prev => ({ ...prev, elements: [...prev.elements, newElement] }));
    setSelectedId(newElement.id);
    selectedIdRef.current = newElement.id;
    setActiveTool(null);
  };

  const handleAddImageSticker = (file: File | Blob) => {
    pushUndo();
    validateStoryFile(file);
    const url = URL.createObjectURL(file);
    stickerUrls.current.push(url);
    const newElement: StoryElement = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'image',
      content: url,
      file: file,
      x: 50, y: 50, scale: 1, rotation: 0, zIndex: Date.now()
    };
    setState(prev => ({ ...prev, elements: [...prev.elements, newElement] }));
    setSelectedId(newElement.id);
    selectedIdRef.current = newElement.id;
  };

  const handleDone = async () => {
    if (publishing.current) return;
    publishing.current = true;
    setIsSharing(true);
    setPublishError('');
    try {
      const response = await fetch(previewUrl);
      if (!response.ok) throw new Error('Could not read this media. Please try another file.');
      const blob = await response.blob();
      validateStoryFile(blob);
      const mentionedUserIds = [...new Set(state.elements.filter(e => e.infoType === 'mention' && e.mentionUserId).map(e => e.mentionUserId!))];
      await onDone(blob, mentionedUserIds, {
        mediaType, originalVideoUrl: mediaType === 'video' ? previewUrl : undefined,
        story_state: state, publicationId: publicationId.current, reshared_post_id: resharedPostId,
      });
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Could not share your story. Your edits are still here—try again.');
    } finally {
      publishing.current = false;
      setIsSharing(false);
    }
  };

  const selected = state.elements.find(el => el.id === selectedId);
  const adjustSelected = (patch: Partial<StoryElement>) => {
    if (!selectedId) return;
    pushUndo();
    setState(prev => ({ ...prev, elements: prev.elements.map(el => el.id === selectedId ? { ...el, ...patch } : el) }));
  };

  return (
    <StoryDialog title={isPreviewMode ? 'Preview your story' : 'Edit story'} onClose={requestClose} className={`story-editor ${isPreviewMode ? 'story-editor--preview' : ''}`}>
      <div data-editor-controls className="studio-top">
        <button onClick={requestClose} disabled={isSharing} className="studio-icon" aria-label={isPreviewMode ? 'Back to editing' : 'Close editor'}><X size={20} /></button>
        <span className="sr-only">{isPreviewMode ? 'Preview' : 'Edit story'}</span>
      </div>
      <div className="studio-workspace">
        <div className="studio-canvas-shell">
          <div className="studio-canvas" ref={canvasRef}
            onPointerDown={isSharing ? undefined : handlePointerDown} onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel}>
            <StoryCanvas state={state}>
              {!isPreviewMode && selectedId && <div className="absolute inset-x-0 top-[12%] bottom-[14%] border-y-2 border-dashed border-white/30 pointer-events-none" />}
            </StoryCanvas>
          </div>
      {/* Drawing Overlay */}
      <StoryDrawingOverlay 
        isActive={activeTool === 'draw'} 
        initialPaths={state.drawingPaths}
        onDone={(paths) => {
          pushUndo(stateRef.current);
          setState(prev => ({ ...prev, drawingPaths: paths }));
          setActiveTool(null);
        }}
        onCancel={() => setActiveTool(null)}
      />
          {!isPreviewMode && state.elements.length > 0 && <div className="studio-selection" data-editor-controls>
            <select aria-label="Select a story layer" value={selectedId || ''} disabled={isSharing} onChange={e => setSelectedId(e.target.value || null)}>
              <option value="">Select layer</option>
              {state.elements.map((el, index) => <option key={el.id} value={el.id}>{index + 1}. {el.type === 'text' ? el.content?.slice(0, 18) : el.type}</option>)}
            </select>
            {selected && <>
              {selected.type === 'text' && <button disabled={isSharing} onClick={() => { setEditingText(selected); setActiveTool('text'); }}>Edit text</button>}
              <button disabled={isSharing} aria-expanded={showLayerControls} onClick={() => setShowLayerControls(value => !value)}>Adjust</button>
              {showLayerControls && <><button disabled={isSharing} aria-label="Move selected layer left" onClick={() => adjustSelected({ x: Math.max(5, selected.x - 5) })}>←</button>
              <button disabled={isSharing} aria-label="Move selected layer right" onClick={() => adjustSelected({ x: Math.min(95, selected.x + 5) })}>→</button>
              <button disabled={isSharing} aria-label="Move selected layer up" onClick={() => adjustSelected({ y: Math.max(5, selected.y - 5) })}>↑</button>
              <button disabled={isSharing} aria-label="Move selected layer down" onClick={() => adjustSelected({ y: Math.min(95, selected.y + 5) })}>↓</button>
              <button disabled={isSharing} aria-label="Make layer smaller" onClick={() => adjustSelected({ scale: Math.max(.2, selected.scale - .1) })}>−</button>
              <button disabled={isSharing} aria-label="Make layer larger" onClick={() => adjustSelected({ scale: Math.min(4, selected.scale + .1) })}>+</button>
              </>}
              <button disabled={isSharing} aria-label="Delete selected layer" onClick={() => { pushUndo(); setState(prev => ({ ...prev, elements: prev.elements.filter(el => el.id !== selectedId) })); setSelectedId(null); }}><Trash2 size={16} /></button>
            </>}
          </div>}
        </div>
        {!isPreviewMode && <div data-editor-controls className="studio-tools" aria-label="Story editing tools">
          <button disabled={isSharing} className="studio-tool" onClick={() => { setEditingText(null); setActiveTool('text'); }}><b className="text-xl font-semibold" aria-hidden="true">Aa</b><span>Text</span></button>
          <button disabled={isSharing} className="studio-tool" onClick={() => setActiveTool('sticker')}><Sticker /><span>Stickers</span></button>
          <button disabled={isSharing} className="studio-tool" onClick={() => photoInput.current?.click()}><ImageIcon /><span>Photo</span></button>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async event => {
            const file = event.target.files?.[0]; event.target.value = '';
            if (!file) return;
            try { if (await inspectStoryFile(file) !== 'image') throw new Error('Choose an image for your photo sticker.'); handleAddImageSticker(file); }
            catch (error) { setPublishError(error instanceof Error ? error.message : 'Could not add photo.'); }
          }} />
          <button disabled={isSharing} className="studio-tool" onClick={() => setActiveTool('draw')}><PenTool /><span>Draw</span></button>
          <button disabled={isSharing} className="studio-tool" onClick={() => setActiveTool('filter')}><Sparkles /><span>Filters</span></button>
          <button disabled={isSharing} className="studio-tool" onClick={() => { pushUndo(); setState(prev => ({ ...prev, background: { ...prev.background, objectFit: prev.background.objectFit === 'cover' ? 'contain' : 'cover', x: 50, y: 50, scale: 1, rotation: 0 } })); }}><Crop /><span>{state.background.objectFit === 'cover' ? 'Fit' : 'Fill'}</span></button>
        </div>}
      </div>
      {publishError && <div className="studio-publish-status"><p className="story-error" role="alert">{publishError}</p></div>}
      {isSharing && <div className="studio-publish-status text-center text-sm text-white bg-black/70 rounded-xl p-3" role="status">Sharing your story… Keep this screen open.</div>}
      <div data-editor-controls className="studio-footer">
        <div className="flex items-center gap-2">
          <button disabled={isSharing || undoStack.length === 0 || isPreviewMode} className="studio-icon" aria-label="Undo last edit" onClick={handleUndo}><Undo2 size={21} /></button>
          <button disabled={isSharing} className="studio-icon" aria-label={isPreviewMode ? 'Back to editing' : 'Preview story'} onClick={() => { setSelectedId(null); setIsPreviewMode(!isPreviewMode); }}><Eye size={21} /></button>
        </div>
        <button onClick={handleDone} disabled={isSharing} className="story-primary" aria-label="Share story">
          {isSharing ? <><SerkleLoader size="xs" className="text-current" /><span>Sharing…</span></> : <><span className="share-avatar"><ImageIcon size={15} /></span><span>Your story</span><ChevronRight size={19} /></>}
        </button>
      </div>
      {/* Trash Zone — visible when dragging */}
      <div className={`absolute bottom-0 inset-x-0 h-[100px] bg-gradient-to-t from-red-600/80 to-transparent flex items-center justify-center z-[150] transition-opacity duration-200 pointer-events-none ${isDragging ? 'opacity-100' : 'opacity-0'}`}>
        <div className={`p-4 rounded-full bg-black/50 text-white transition-transform duration-150 ${isOverTrash ? 'scale-125 bg-red-600' : ''}`}>
          <Trash2 className="w-8 h-8" />
        </div>
      </div>

      {/* Tool Overlays */}
      {activeTool === 'text' && <StoryTextOverlay initialElement={editingText || undefined} onAdd={handleAddText} onClose={() => setActiveTool(null)} />}
      {activeTool === 'sticker' && <StoryStickerPicker onAdd={handleAddSticker} onClose={() => setActiveTool(null)} />}
      {activeTool === 'filter' && (
        <div className="absolute inset-x-0 bottom-0 z-[150]">
          <StoryFilterPicker 
            previewUrl={mediaType === 'image' ? previewUrl : undefined}
            selectedId={state.background.filterCss || 'none'} 
            onSelect={(id, css) => {
              pushUndo(stateRef.current);
              setState(prev => ({ ...prev, background: { ...prev.background, filterCss: css } }));
            }} 
            onClose={() => setActiveTool(null)} 
          />
        </div>
      )}
      


      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent className="rounded-2xl bg-white text-[#111] w-[calc(100%_-_32px)]">
          <AlertDialogTitle>Leave this story?</AlertDialogTitle>
          <AlertDialogDescription>Your changes haven’t been shared. Leaving will discard this draft.</AlertDialogDescription>
          <AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={onCancel}>Discard draft</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StoryDialog>
  );
}

export default StoryEditor;
