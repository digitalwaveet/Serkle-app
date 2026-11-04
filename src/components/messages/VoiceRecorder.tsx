import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Mic, X, Lock, Send } from 'lucide-react';
import { uploadChatMedia } from '@/lib/chatMedia';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  conversationId: string;
  onSend: (type: string, url: string, label: string) => void;
}

/** Pick the best supported MIME type for MediaRecorder */
function getSupportedMimeType(): { mimeType: string; ext: string } {
  const candidates = [
    { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
    { mimeType: 'audio/webm', ext: 'webm' },
    { mimeType: 'audio/mp4', ext: 'mp4' },
    { mimeType: 'audio/ogg;codecs=opus', ext: 'ogg' },
    { mimeType: 'audio/wav', ext: 'wav' },
    { mimeType: '', ext: 'webm' }, // fallback: let browser choose
  ];
  for (const c of candidates) {
    if (!c.mimeType || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType))) {
      return c;
    }
  }
  return candidates[candidates.length - 1];
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ conversationId, onSend }) => {
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const [time, setTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const [slideY, setSlideY] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0); // wall-clock start time
  const mimeRef = useRef(getSupportedMimeType());
  const isStartingRef = useRef(false); // guard against race condition
  const cancelledRef = useRef(false); // true if user cancelled before getUserMedia resolved

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const resetState = useCallback(() => {
    setRecording(false);
    setLocked(false);
    setTime(0);
    setSlideX(0);
    setSlideY(0);
  }, []);

  const stopAndCleanup = useCallback(() => {
    cancelledRef.current = true;
    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch { /* ignore */ }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    clearTimer();
    releaseStream();
    resetState();
  }, [clearTimer, releaseStream, resetState]);

  const uploadAndSend = useCallback(async () => {
    const mime = mimeRef.current;
    const blob = new Blob(chunksRef.current, { type: mime.mimeType || 'audio/webm' });
    chunksRef.current = [];

    if (blob.size < 500) {
      toast.error('Recording too short');
      return;
    }

    // Calculate real duration from wall-clock
    const durationSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));

    setUploading(true);
    try {
      const fileName = `voice_${Date.now()}.${mime.ext}`;
      const file = new File([blob], fileName, { type: mime.mimeType || 'audio/webm' });
      const reference = await uploadChatMedia(conversationId, file, fileName);
      onSend('voice', reference, `🎤 Voice (${durationSec}s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send voice message');
    } finally {
      setUploading(false);
    }
  }, [conversationId, onSend]);

  const startRecording = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    cancelledRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // If user released / cancelled while we were waiting for permission
      if (cancelledRef.current) {
        stream.getTracks().forEach(t => t.stop());
        isStartingRef.current = false;
        return;
      }

      streamRef.current = stream;
      const mime = mimeRef.current;

      const options: MediaRecorderOptions = {};
      if (mime.mimeType) options.mimeType = mime.mimeType;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // Use timeslice so we get chunks every 250ms (important for short recordings)
      mediaRecorder.start(250);
      startTimeRef.current = Date.now();
      setRecording(true);
      setTime(0);

      timerRef.current = setInterval(() => {
        setTime(prev => {
          if (prev >= 59) {
            // Auto-stop at 60s — trigger send
            clearTimer();
            if (mediaRecorderRef.current?.state === 'recording') {
              mediaRecorderRef.current.onstop = () => {
                releaseStream();
                uploadAndSend();
              };
              mediaRecorderRef.current.stop();
            }
            resetState();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast.error('Microphone access denied');
    } finally {
      isStartingRef.current = false;
    }
  }, [clearTimer, releaseStream, resetState, uploadAndSend]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startRecording();
  }, [startRecording]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!recording || locked) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    setSlideX(Math.min(0, dx));
    setSlideY(Math.min(0, dy));

    if (dx < -100) {
      stopAndCleanup();
    }
    if (dy < -60) {
      setLocked(true);
      setSlideX(0);
      setSlideY(0);
    }
  }, [recording, locked, stopAndCleanup]);

  const finishAndSend = useCallback(() => {
    clearTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.onstop = () => {
        releaseStream();
        uploadAndSend();
      };
      recorder.stop();
    } else {
      releaseStream();
    }
    mediaRecorderRef.current = null;
    resetState();
  }, [clearTimer, releaseStream, resetState, uploadAndSend]);

  const handlePointerUp = useCallback(() => {
    if (isStartingRef.current && !recording) {
      // getUserMedia is still pending — mark cancelled so it won't start
      cancelledRef.current = true;
      return;
    }
    if (!recording) return;
    if (locked) return; // locked mode uses send button
    finishAndSend();
  }, [recording, locked, finishAndSend]);

  const handleLockedSend = useCallback(() => {
    finishAndSend();
  }, [finishAndSend]);

  const handleLockedCancel = useCallback(() => {
    stopAndCleanup();
  }, [stopAndCleanup]);

  useEffect(() => {
    return () => {
      clearTimer();
      releaseStream();
    };
  }, [clearTimer, releaseStream]);

  const timeStr = `${Math.floor(time / 60)}:${time % 60 < 10 ? '0' : ''}${time % 60}`;

  if (uploading) {
    return (
      <div className="p-2 shrink-0">
        <SerkleLoader size="xs" className="text-primary" />
      </div>
    );
  }

  const recordingOverlay = recording ? (
    <div className="absolute bottom-full left-0 right-0 bg-background border-t border-border animate-fade-in">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          onClick={locked ? handleLockedCancel : stopAndCleanup}
          className="p-2 rounded-full hover:bg-destructive/10 transition-colors shrink-0"
        >
          <X className="h-5 w-5 text-destructive" />
        </button>

        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />
        <span className="text-sm font-mono font-medium text-destructive shrink-0 w-10">{timeStr}</span>

        <div className="flex items-center gap-[2px] flex-1 min-w-0 overflow-hidden h-8">
          {Array.from({ length: 32 }).map((_, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full bg-destructive/50 shrink-0"
              style={{
                height: `${6 + Math.sin((time * 3 + i) * 0.7) * 12 + Math.random() * 4}px`,
                transition: 'height 0.15s',
              }}
            />
          ))}
        </div>

        {!locked ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">← Cancel</span>
            <div
              className="transition-opacity"
              style={{ opacity: slideY < -20 ? 1 : 0.4 }}
            >
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ) : (
          <button
            onClick={handleLockedSend}
            className="h-10 w-10 rounded-full bg-primary flex items-center justify-center active:scale-90 transition-transform shadow-lg shrink-0"
          >
            <Send className="h-5 w-5 text-primary-foreground" />
          </button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {recordingOverlay}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`shrink-0 h-11 w-11 rounded-full flex items-center justify-center active:scale-90 transition-transform touch-none select-none ${
          recording ? 'bg-destructive' : 'bg-primary'
        }`}
      >
        <Mic className={`h-5 w-5 ${recording ? 'text-white' : 'text-primary-foreground'}`} />
      </button>
    </>
  );
};

export default VoiceRecorder;
