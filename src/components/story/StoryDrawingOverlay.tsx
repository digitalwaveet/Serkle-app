import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';
import { DrawingPath } from '@/types/storyTypes';
import { CANVAS_W, CANVAS_H } from './StoryCanvas';
import { ChevronLeft, Undo2, Check } from 'lucide-react';

interface StoryDrawingOverlayProps {
  isActive: boolean;
  initialPaths: DrawingPath[];
  onDone: (paths: DrawingPath[]) => void;
  onCancel: () => void;
}

const COLORS = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00',
  '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55'
];

const BRUSH_SIZES = [
  { id: 'S', size: 6 },
  { id: 'M', size: 14 },
  { id: 'L', size: 24 }
];

export function getSvgPathFromStroke(stroke: number[][]) {
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

export function StoryDrawingOverlay({ isActive, initialPaths, onDone, onCancel }: StoryDrawingOverlayProps) {
  const [paths, setPaths] = useState<DrawingPath[]>(initialPaths);
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const [color, setColor] = useState('#FFFFFF');
  const [brushSize, setBrushSize] = useState(14);
  const [isEraser, setIsEraser] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const history = useRef<DrawingPath[][]>([]);
  const pointAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y, e.pressure || .5];
  };

  useEffect(() => {
    if (isActive) {
      setPaths(initialPaths);
      history.current = [];
    }
  }, [isActive, initialPaths]);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    history.current.push(paths);
    
    // Convert client coordinates to internal 1080x1920 coordinates
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const point = pointAt(e);
    if (!point) return;
    if (isEraser) setPaths(previous => previous.filter(path => !path.points.some(p => Math.hypot(p[0] - point[0], p[1] - point[1]) < 50)));
    else setCurrentPoints([point]);
  }, [paths, isEraser]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 1) return;
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const point = pointAt(e);
    if (!point) return;
    if (isEraser) setPaths(previous => previous.filter(path => !path.points.some(p => Math.hypot(p[0] - point[0], p[1] - point[1]) < 50)));
    else setCurrentPoints(prev => [...prev, point]);
  }, [isEraser]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (currentPoints.length === 0) return;
    
    const newPath: DrawingPath = {
      id: Math.random().toString(36).substr(2, 9),
      points: currentPoints,
      color,
      size: brushSize
    };
    
    setPaths(prev => [...prev, newPath]);
    setCurrentPoints([]);
  }, [currentPoints, color, brushSize, isEraser]);

  const handleUndo = () => {
    const previous = history.current.pop();
    if (previous) setPaths(previous);
  };

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-[150] flex flex-col pointer-events-auto">
      {/* Top Bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <button aria-label="Cancel drawing" onClick={onCancel} className="p-2 text-white/90 hover:text-white bg-black/20 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-4">
          <button aria-label="Undo drawing" onClick={handleUndo} disabled={history.current.length === 0} className="p-2 text-white disabled:opacity-50 drop-shadow-md">
            <Undo2 size={24} />
          </button>
          <button aria-label="Finish drawing" onClick={() => onDone(paths)} className="p-2 bg-white text-black rounded-full shadow-lg">
            <Check size={24} />
          </button>
        </div>
      </div>

      {/* The Drawing Surface */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
        {/* We place the SVG overlay such that it EXACTLY covers the StoryCanvas underneath. 
            StoryCanvas scales its content, so we just make our SVG scale identically. */}
        <div className="absolute inset-0 pointer-events-auto touch-none" style={{ width: '100%', height: '100%' }}>
           <svg 
            ref={svgRef}
            className="w-full h-full"
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Render committed paths */}
            {paths.map(path => {
              if (path.color === 'erase') return null; // Simplified eraser: we don't render it, or we could use mask
              const stroke = getStroke(path.points, { size: path.size, thinning: 0.5, smoothing: 0.5, streamline: 0.5 });
              const d = getSvgPathFromStroke(stroke);
              return <path key={path.id} d={d} fill={path.color} />;
            })}
            
            {/* Render active stroke */}
            {currentPoints.length > 0 && !isEraser && (
              <path 
                d={getSvgPathFromStroke(getStroke(currentPoints, { size: brushSize, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }))} 
                fill={color} 
              />
            )}
          </svg>
        </div>
      </div>

      {/* Bottom Tools */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col gap-2">
        {/* Brush Sizes */}
        <div className="flex justify-center gap-6">
          {BRUSH_SIZES.map(b => (
            <button 
              key={b.id}
              aria-label={`Brush size ${b.id}`}
              onClick={() => { setBrushSize(b.size); setIsEraser(false); }}
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${!isEraser && brushSize === b.size ? 'border-white bg-white/20' : 'border-transparent bg-black/40 text-white'}`}
            >
              <div className="bg-white rounded-full" style={{ width: b.size/2, height: b.size/2 }} />
            </button>
          ))}
          {/* Eraser Toggle */}
          <button 
            onClick={() => setIsEraser(true)}
            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all text-sm font-medium ${isEraser ? 'border-white bg-white/20 text-white' : 'border-transparent bg-black/40 text-white/70'}`}
          >
            Del
          </button>
        </div>

        {/* Colors */}
        {!isEraser && (
          <div className="flex justify-center gap-3 overflow-x-auto px-2 snap-x">
            {COLORS.map(c => (
              <button 
                key={c}
                aria-label={`Drawing color ${c}`}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full snap-center flex-shrink-0 border-2 transition-transform ${color === c ? 'scale-110 border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
