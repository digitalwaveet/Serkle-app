import { useState, useEffect, useCallback, useRef } from 'react';

export type ProgressivePhase = 
  | 'idle' 
  | 'reading' 
  | 'compressing' 
  | 'preview' 
  | 'loading-full' 
  | 'done' 
  | 'error';

interface MediaStats {
  originalSize: number;
  previewSize: number;
  savedPct: number;
  ttfp: number; // Time to First Pixel in ms
}

// Singleton Worker Setup
let mediaWorker: Worker | null = null;
const pendingCallbacks = new Map<string, (data: any) => void>();

const getWorker = () => {
  if (typeof window === 'undefined') return null;
  if (!mediaWorker) {
    mediaWorker = new Worker('/mediaWorker.js');
    mediaWorker.onmessage = (e) => {
      const { id, stage, ...rest } = e.data;
      const key = `${id}:${stage}`;
      const cb = pendingCallbacks.get(key);
      if (cb) {
        cb(rest);
        pendingCallbacks.delete(key);
      }
    };
  }
  return mediaWorker;
};

export const useProgressiveMedia = () => {
  const [phase, setPhase] = useState<ProgressivePhase>('idle');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [fullSrc, setFullSrc] = useState<string | null>(null);
  const [stats, setStats] = useState<MediaStats | null>(null);
  
  const startTimeRef = useRef<number>(0);
  const idRef = useRef<string>(Math.random().toString(36).substring(7));

  // Cleanup Object URLs
  useEffect(() => {
    return () => {
      if (previewSrc) URL.revokeObjectURL(previewSrc);
      if (fullSrc) URL.revokeObjectURL(fullSrc);
    };
  }, [previewSrc, fullSrc]);

  const load = useCallback(async (file: File) => {
    const worker = getWorker();
    if (!worker) return;

    const id = idRef.current;
    startTimeRef.current = performance.now();
    setPhase('reading');

    try {
      // 1. Read file into ArrayBuffer
      const buffer = await file.arrayBuffer();
      setPhase('compressing');

      // 2. Request Preview
      const ttfpPromise = new Promise<any>((resolve) => {
        pendingCallbacks.set(`${id}:preview`, resolve);
      });

      // Transfer buffer to worker for preview
      worker.postMessage({
        id,
        stage: 'preview',
        buffer,
        type: file.type,
        fileName: file.name
      }, [buffer]);

      const previewData = await ttfpPromise;
      if (previewData.error) throw new Error(previewData.error);

      const previewUrl = URL.createObjectURL(previewData.blob);
      setPreviewSrc(previewUrl);
      setPhase('preview');

      // Calculate TTFP
      const ttfp = Math.round(performance.now() - startTimeRef.current);
      
      // 3. Request Full Version (Same buffer, need new reading if transferred?)
      // Wait, once transferred, the buffer is detached. 
      // We should either NOT transfer it the first time, or re-read.
      // Re-reading from File is fast and memory efficient.
      setPhase('loading-full');
      const fullBuffer = await file.arrayBuffer();

      const fullPromise = new Promise<any>((resolve) => {
        pendingCallbacks.set(`${id}:full`, resolve);
      });

      worker.postMessage({
        id,
        stage: 'full',
        buffer: fullBuffer,
        type: file.type,
        fileName: file.name
      }, [fullBuffer]);

      const fullData = await fullPromise;
      if (fullData.error) throw new Error(fullData.error);

      const fullUrl = URL.createObjectURL(fullData.blob);
      setFullSrc(fullUrl);
      
      // Update Stats
      const originalSize = fullData.originalSize;
      const finalSize = fullData.previewSize; // This is actually the full compressed size here
      const savedPct = Math.round(((originalSize - finalSize) / originalSize) * 100);

      setStats({
        originalSize,
        previewSize: finalSize,
        savedPct,
        ttfp
      });

      setPhase('done');
    } catch (err) {
      console.error('[ProgressiveMedia] Failed:', err);
      setPhase('error');
    }
  }, []);

  return {
    phase,
    previewSrc,
    fullSrc,
    stats,
    load
  };
};
