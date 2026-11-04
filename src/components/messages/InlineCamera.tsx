import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, SwitchCamera, Camera, ZoomIn, ZoomOut } from 'lucide-react';

interface InlineCameraProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

const InlineCamera: React.FC<InlineCameraProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isReady, setIsReady] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsReady(false);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
      }

      // Apply zoom if supported
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities?.zoom) {
        const settings = { advanced: [{ zoom: Math.min(zoom, capabilities.zoom.max) }] } as any;
        await track.applyConstraints(settings);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setError(err.name === 'NotAllowedError' 
        ? 'Camera access denied. Please allow camera permissions.' 
        : 'Unable to access camera.');
    }
  }, [zoom]);

  useEffect(() => {
    startCamera(facingMode);

    // Check for multiple cameras
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    });

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZoom = useCallback(async (newZoom: number) => {
    setZoom(newZoom);
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities?.zoom) {
        const clampedZoom = Math.max(capabilities.zoom.min, Math.min(newZoom, capabilities.zoom.max));
        await track.applyConstraints({ advanced: [{ zoom: clampedZoom }] } as any);
      }
    }
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d')!;
    // Mirror for selfie
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    setCaptured(canvas.toDataURL('image/jpeg', 0.92));
  };

  const handleConfirm = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      'image/jpeg',
      0.92
    );
  };

  const handleRetake = () => {
    setCaptured(null);
  };

  const switchCamera = () => {
    setFacingMode(f => f === 'environment' ? 'user' : 'environment');
    setCaptured(null);
    setZoom(1);
  };

  const content = (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col select-none">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
        >
          <X className="h-5 w-5 text-white" />
        </button>
        <span className="text-white/80 text-sm font-medium">
          {captured ? 'Preview' : 'Camera'}
        </span>
        <div className="w-10" />
      </div>

      {/* Camera view / Preview */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="text-center">
              <Camera className="h-12 w-12 text-white/30 mx-auto mb-3" />
              <p className="text-white/70 text-sm">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-card/10 rounded-full text-white text-sm active:bg-card/20 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : captured ? (
          <img
            src={captured}
            alt="Captured"
            className="w-full h-full object-contain"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <SerkleLoader size="md" className="text-white/50" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent pt-12 pb-safe">
        {captured ? (
          /* Preview controls */
          <div className="flex items-center justify-center gap-6 pb-8">
            <button
              type="button"
              onClick={handleRetake}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="h-14 w-14 rounded-full bg-card/10 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform border border-white/20">
                <X className="h-6 w-6 text-white" />
              </div>
              <span className="text-white/60 text-[10px] font-medium">Retake</span>
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-primary/30">
                <Camera className="h-7 w-7 text-primary-foreground" />
              </div>
              <span className="text-white/80 text-[10px] font-semibold">Send</span>
            </button>
          </div>
        ) : (
          /* Camera controls */
          <div className="flex flex-col items-center gap-4 pb-8">
            {/* Zoom controls */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleZoom(Math.max(1, zoom - 0.5))}
                className="h-8 w-8 rounded-full bg-card/10 flex items-center justify-center active:bg-card/20 transition-colors"
              >
                <ZoomOut className="h-3.5 w-3.5 text-white/70" />
              </button>
              <span className="text-white/60 text-xs font-medium min-w-[32px] text-center">
                {zoom.toFixed(1)}x
              </span>
              <button
                type="button"
                onClick={() => handleZoom(Math.min(5, zoom + 0.5))}
                className="h-8 w-8 rounded-full bg-card/10 flex items-center justify-center active:bg-card/20 transition-colors"
              >
                <ZoomIn className="h-3.5 w-3.5 text-white/70" />
              </button>
            </div>

            {/* Shutter + flip */}
            <div className="flex items-center justify-center gap-10">
              <div className="w-12" />
              <button
                type="button"
                onClick={handleCapture}
                disabled={!isReady}
                className="h-[72px] w-[72px] rounded-full border-[4px] border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
              >
                <div className="h-[60px] w-[60px] rounded-full bg-card active:bg-card/80 transition-colors" />
              </button>
              {hasMultipleCameras ? (
                <button
                  type="button"
                  onClick={switchCamera}
                  className="h-12 w-12 rounded-full bg-card/10 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform border border-white/10"
                >
                  <SwitchCamera className="h-5 w-5 text-white" />
                </button>
              ) : (
                <div className="w-12" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );

  return createPortal(content, document.body);
};

export default InlineCamera;