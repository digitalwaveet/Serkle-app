import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { readShareDraft, removeShareDraft } from '@/lib/shareDraft';
import { ArrowLeft, Camera, MapPin, Users, Globe, Image, Video, Mic, X, Square, Pencil, ChevronLeft, ChevronRight, Wand2, FileText } from 'lucide-react';
import ImageCropper from '@/components/ImageCropper';
import VideoEditorModal from '@/components/VideoEditorModal';
import { InlineVideoLoader } from '@/components/ui/VideoLoader';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/contexts/UserContext';
import { usePostMutations } from '@/hooks/usePostMutations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MentionTextarea from '@/components/MentionTextarea';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';
import { PDFPreview } from '@/components/post/PDFPreview';

const CreatePost: React.FC<{ shareId?: string }> = ({ shareId }) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { createPost, isCreating } = usePostMutations();
  const [postText, setPostText] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('public');
  const fileManager = useFileManager();
  const [shareState, setShareState] = useState<'loading' | 'ready' | 'error'>(shareId ? 'loading' : 'ready');
  const addSharedFiles = fileManager.addFiles;
  useEffect(() => {
    if (!shareId || !user?.id) return;
    let cancelled = false;
    void readShareDraft(shareId, user.id).then(draft => {
      if (cancelled) return;
      if (!draft) { setShareState('error'); return; }
      setPostText(draft.text);
      addSharedFiles(draft.files.map(file => ({
        id: crypto.randomUUID(), file, url: URL.createObjectURL(file),
        kind: 'image' as const, name: file.name, size: file.size,
        mimeType: file.type, status: 'idle' as const,
      })));
      setShareState('ready');
    }).catch(() => { if (!cancelled) setShareState('error'); });
    return () => { cancelled = true; };
  }, [shareId, user?.id, addSharedFiles]);
  const [locationText, setLocationText] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editingImage, setEditingImage] = useState<{ id: string; url: string } | null>(null);
  const [editingVideo, setEditingVideo] = useState<{ id: string; url: string; file: File } | null>(null);
  const [videoEdits, setVideoEdits] = useState<Map<string, { thumbnailBlob: Blob; trimStart: number; trimEnd: number }>>(new Map());
  
  // PDF Document States
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<{ blob: Blob; url: string }[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);
  const requestRef = useRef<{ snapshot: string; id: string } | null>(null);

  const resolveLocation = async (pos: GeolocationPosition) => {
    const { latitude, longitude } = pos.coords;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`);
      const data = await res.json();
      const addr = data.address;
      const readable = [addr.road, addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village, addr.country].filter(Boolean).join(', ');
      setLocationText(readable || data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } catch {
      setLocationText(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    }
    setLoadingLocation(false);
  };

  const handleLocationError = (error: GeolocationPositionError) => {
    let msg = 'Unable to get location';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        msg = 'Location permission denied. Please enable location access in your browser/phone settings and try again.';
        break;
      case error.POSITION_UNAVAILABLE:
        msg = 'Location unavailable. Please check that GPS/Location Services are turned on.';
        break;
      case error.TIMEOUT:
        msg = 'Location request timed out. Retrying...';
        break;
    }
    return { msg, isTimeout: error.code === error.TIMEOUT };
  };

  const handleAddLocation = () => {
    if (locationText) {
      setLocationText(null);
      return;
    }
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported on this device');
      return;
    }
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      resolveLocation,
      (error) => {
        const { msg, isTimeout } = handleLocationError(error);
        if (isTimeout) {
          toast.info(msg);
          navigator.geolocation.getCurrentPosition(
            resolveLocation,
            (retryError) => {
              const { msg: retryMsg } = handleLocationError(retryError);
              toast.error(retryMsg);
              setLoadingLocation(false);
            },
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
          );
        } else {
          toast.error(msg);
          setLoadingLocation(false);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
      };

      mediaRecorder.start();
      setRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 29) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setRecordingTime(0);
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed for this post type');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('PDF file size must be less than 50MB');
      return;
    }

    setIsProcessingPdf(true);
    setPdfProgress({ current: 0, total: 0 });
    setPdfFile(file);
    fileManager.clear(); // Clear other media as per "PDF-only" requirement

    try {
      const { renderPDFToImages } = await import('@/lib/pdfUtils');
      const pages = await renderPDFToImages(file, (current, total) => {
        setPdfProgress({ current, total });
      });

      const pagesWithUrls = pages.map(p => ({
        blob: p.blob,
        url: URL.createObjectURL(p.blob)
      }));

      setPdfPages(pagesWithUrls);
      setIsPreviewMode(true);
      toast.success('PDF processed successfully!');
    } catch (err) {
      console.error('PDF processing failed', err);
      toast.error('Failed to process PDF. It might be corrupted or protected.');
      setPdfFile(null);
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const handlePost = async () => {
    if (!user) { navigate('/login'); return; }
    if (shareState !== 'ready' || isCreating || submittingRef.current) return;
    submittingRef.current = true;

    // Reuse the same key when retrying the same draft after an uncertain
    // network result. Any edited draft gets a fresh key.
    const snapshot = JSON.stringify({
      text: postText,
      privacy,
      locationText,
      files: fileManager.files.map(item => [item.name, item.size, item.file.lastModified]),
      pdf: pdfFile ? [pdfFile.name, pdfFile.size, pdfFile.lastModified] : null,
      voice: voiceBlob ? [voiceBlob.size, voiceBlob.type] : null,
    });
    if (!requestRef.current || requestRef.current.snapshot !== snapshot) {
      requestRef.current = { snapshot, id: crypto.randomUUID() };
    }
    const requestId = requestRef.current.id;

    try {
      let voiceUrl: string | undefined;
      // ... (voice upload logic remains same)
      if (voiceBlob) {
        const file = new File([voiceBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        const path = `${user.id}/voice-${requestId}.webm`;
        const { error } = await supabase.storage.from('post-media').upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from('post-media').getPublicUrl(path);
        voiceUrl = data.publicUrl;
      }

      let coverImage: File | undefined;
      const firstVideo = fileManager.files.find(item => item.kind === 'video');
      
      if (firstVideo) {
        const storedEdit = videoEdits.get(firstVideo.id);
        if (storedEdit) {
          coverImage = new File([storedEdit.thumbnailBlob], `thumb_${firstVideo.name}.jpg`, { type: 'image/jpeg' });
        } else {
          try {
            const { generateVideoThumbnail } = await import('@/lib/videoUtils');
            const thumb = await generateVideoThumbnail(firstVideo.file as File);
            coverImage = new File([thumb.blob], `thumb_${firstVideo.name}.jpg`, { type: 'image/jpeg' });
          } catch (err) {
            console.error('Thumbnail generation failed', err);
          }
        }
      }

      // Convert PDF pages to Files for upload if in PDF mode
      let mediaFiles: File[] = [];
      if (pdfFile && pdfPages.length > 0) {
        mediaFiles = pdfPages.map((p, i) => new File([p.blob], `page-${i + 1}.webp`, { type: 'image/webp' }));
      } else {
        mediaFiles = fileManager.files.map(item => item.file as File);
      }

      await createPost(
        {
          content: postText,
          media: mediaFiles,
          locationText: locationText || undefined,
          voiceUrl,
          coverImage,
          postType: pdfFile ? 'pdf' : (fileManager.files.length > 0 ? 'photo' : 'text'),
          originalPdf: pdfFile || undefined,
          visibility: privacy === 'friends' ? 'friends' : 'public',
        },
        user.id,
        requestId
      );
      if (shareId) await removeShareDraft(shareId, user.id).catch(() => undefined);
      navigate('/');
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      submittingRef.current = false;
    }
  };

  const privacyOptions = [
    { value: 'public', label: 'Public', icon: Globe },
    { value: 'friends', label: 'Friends', icon: Users },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => navigate('/')} className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <h1 className="text-lg font-semibold">Create Post</h1>
          <Button onClick={handlePost} disabled={(!postText.trim() && !fileManager.files.length && !pdfFile && !voiceBlob) || isCreating || shareState !== 'ready'} className="px-6">
            {isCreating ? <span className="flex items-center gap-2"><InlineVideoLoader />Posting...</span> : 'Post'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {shareId && <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4" aria-live="polite">
          <p>{shareState === 'loading' ? 'Preparing your shared draft…' : shareState === 'error' ? 'This shared draft expired, is unavailable, or belongs to another account.' : 'Shared draft — review the content and audience before posting. Nothing has been uploaded yet.'}</p>
          <Button variant="ghost" disabled={isCreating} onClick={async () => {
            try { if (user) await removeShareDraft(shareId, user.id); navigate('/'); }
            catch { toast.error('Could not discard the draft. Please try again.'); }
          }}>Discard shared draft</Button>
        </section>}
        {/* User Info */}
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10 border border-primary/10">
            <AvatarImage src={user?.avatar} alt={user?.name} />
            <AvatarFallback className="bg-primary text-primary-foreground font-bold">{user?.initials || 'U'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-bold text-foreground">{user?.name || 'Your Name'}</p>
            <div className="flex items-center space-x-2 mt-1">
              {privacyOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setPrivacy(option.value as 'public' | 'friends' | 'private')}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                      privacy === option.value
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <IconComponent className="w-3 h-3" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Post Content */}
        <div className="relative">
          <MentionTextarea
            placeholder="What's on your mind?"
            value={postText}
            onChange={setPostText}
            className="w-full min-h-[150px] border-none p-0 text-lg resize-none outline-none bg-transparent placeholder:text-muted-foreground/60"
            dir="auto"
            rows={5}
          />
        </div>

        {/* Media Preview List / PDF Preview */}
        {isPreviewMode && pdfPages.length > 0 ? (
          <PDFPreview 
            pages={pdfPages} 
            fileName={pdfFile?.name || 'document.pdf'} 
            onRemove={() => {
              setPdfPages([]);
              setPdfFile(null);
              setIsPreviewMode(false);
            }} 
          />
        ) : fileManager.files.length > 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-widest ml-1">Attached Media</h3>
              <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-black">
                {fileManager.files.length} {fileManager.files.length === 1 ? 'FILE' : 'FILES'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {fileManager.files.map((item) => (
                <div key={item.id} className="group relative aspect-square rounded-[2rem] overflow-hidden shadow-md border border-border/50 bg-muted/20">
                  {item.kind === 'video' ? (
                    <video src={item.url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Preview" />
                  )}
                  
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                    {item.kind === 'image' && (
                      <button
                        onClick={() => setEditingImage({ id: item.id, url: item.url })}
                        className="p-3 bg-white/20 backdrop-blur-xl text-white rounded-2xl hover:bg-white/30 transition-all transform scale-90 group-hover:scale-100 shadow-xl border border-white/10"
                        title="Edit Photo"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                    )}
                    {item.kind === 'video' && (
                      <button
                        onClick={() => setEditingVideo({ id: item.id, url: item.url, file: item.file as File })}
                        className="p-3 bg-white/20 backdrop-blur-xl text-white rounded-2xl hover:bg-white/30 transition-all transform scale-90 group-hover:scale-100 shadow-xl border border-white/10"
                        title="Edit Video"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => fileManager.removeFile(item.id)}
                      className="p-3 bg-destructive/80 backdrop-blur-xl text-white rounded-2xl hover:bg-destructive transition-all transform scale-90 group-hover:scale-100 shadow-xl"
                      title="Remove"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Type Badge */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-black/40 backdrop-blur-md border border-white/10">
                    <span className="text-[10px] text-white font-black uppercase tracking-widest">
                      {item.kind}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location & Voice Badges */}
        <div className="flex flex-col gap-2">
          {locationText && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-2xl border border-primary/20 animate-in zoom-in-95 duration-200 w-fit">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-primary font-bold truncate max-w-[200px]">{locationText}</span>
              <button onClick={() => setLocationText(null)} className="ml-1 p-0.5 hover:bg-primary/20 rounded-full transition-colors">
                <X className="w-3.5 h-3.5 text-primary" />
              </button>
            </div>
          )}
          {voiceBlob && !recording && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-2xl border border-primary/20 animate-in zoom-in-95 duration-200 w-full max-w-sm">
              <Mic className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-primary font-bold shrink-0">Voice</span>
              <audio 
                src={URL.createObjectURL(voiceBlob)} 
                controls 
                className="h-8 flex-1 min-w-[120px]" 
              />
              <button onClick={() => setVoiceBlob(null)} className="ml-1 p-1 hover:bg-primary/20 rounded-full transition-colors shrink-0">
                <X className="w-4 h-4 text-primary" />
              </button>
            </div>
          )}
        </div>

        {/* Additional Options */}
        <div className="space-y-4 pt-4 border-t border-border/50">
          <div className="grid grid-cols-2 gap-3">
            <CustomFilePicker manager={fileManager} hideUploadButton hidePreviewList accept="image/*" multiple={true} disabled={!!pdfFile}>
              <button disabled={!!pdfFile} className="w-full flex items-center p-4 rounded-3xl bg-primary/5 hover:bg-primary/10 border border-primary/10 transition-all group active:scale-95 duration-200 disabled:opacity-50 disabled:grayscale">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary mr-3 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm shadow-primary/10">
                  <Image className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-foreground tracking-tight">Photo</p>
                  <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-tighter">Gallery</p>
                </div>
              </button>
            </CustomFilePicker>

            <CustomFilePicker manager={fileManager} hideUploadButton hidePreviewList accept="video/*" multiple={true} disabled={!!pdfFile}>
              <button disabled={!!pdfFile} className="w-full flex items-center p-4 rounded-3xl bg-secondary/5 hover:bg-secondary/10 border border-secondary/10 transition-all group active:scale-95 duration-200 disabled:opacity-50 disabled:grayscale">
                <div className="p-3 rounded-2xl bg-secondary/10 text-secondary mr-3 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300 shadow-sm shadow-secondary/10">
                  <Video className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-foreground tracking-tight">Video</p>
                  <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-tighter">Clips</p>
                </div>
              </button>
            </CustomFilePicker>
          </div>

          <div className="space-y-2">
            <input
              type="file"
              id="pdf-upload"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />
            <button 
              onClick={() => document.getElementById('pdf-upload')?.click()}
              disabled={fileManager.files.length > 0 || isProcessingPdf}
              className="w-full flex items-center p-4 rounded-3xl bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 transition-all group active:scale-[0.98] duration-200 disabled:opacity-50 disabled:grayscale"
            >
              <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-500 mr-3 group-hover:scale-110 transition-all duration-300 shadow-sm shadow-orange-500/10">
                {isProcessingPdf ? <SerkleLoader size="xs" className="text-current" /> : <FileText className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <p className="text-sm font-black text-foreground tracking-tight">
                  {pdfFile ? 'PDF Attached' : 'Document'}
                </p>
                <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-tighter">
                  {isProcessingPdf ? `Processing: ${pdfProgress.current}/${pdfProgress.total}` : pdfFile ? pdfFile.name : 'PDF Only'}
                </p>
              </div>
            </button>
            
            <button onClick={handleAddLocation} className="w-full flex items-center p-4 rounded-3xl bg-muted/30 hover:bg-muted/50 border border-border/50 transition-all group active:scale-[0.98] duration-200">
              <div className={`p-3 rounded-2xl mr-3 group-hover:scale-110 transition-all duration-300 shadow-sm ${locationText ? 'bg-primary/20 text-primary shadow-primary/10' : 'bg-muted text-muted-foreground shadow-black/5'}`}>
                {loadingLocation ? (
                  <SerkleLoader size="xs" className="text-current" />
                ) : (
                  <MapPin className="w-5 h-5" />
                )}
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className={`text-sm font-black tracking-tight ${locationText ? 'text-primary' : 'text-foreground'}`}>
                  {locationText ? 'Location Added' : 'Check In'}
                </p>
                <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-tighter truncate">
                  {locationText || 'Share where you are'}
                </p>
              </div>
              {locationText && <Wand2 className="w-4 h-4 text-primary animate-pulse" />}
            </button>
            
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={!!voiceBlob && !recording}
              aria-pressed={recording}
              className="w-full flex items-center p-4 rounded-3xl bg-muted/30 hover:bg-muted/50 border border-border/50 transition-all group active:scale-[0.98] duration-200 disabled:opacity-50"
            >
              <div className={`engagement-btn engagement-btn--icon-only mr-3 shadow-sm ${recording ? 'engagement-btn--mic-active bg-[#4F69C4]/10' : voiceBlob ? 'bg-primary/20 text-primary shadow-primary/10' : 'bg-muted text-[#71829A] shadow-black/5'}`}>
                <Mic strokeWidth={1.85} className="engagement-icon" />
              </div>
              <div className="text-left">
                <p className={`text-sm font-black tracking-tight ${recording ? 'text-[#4F69C4]' : voiceBlob ? 'text-primary' : 'text-foreground'}`}>
                  {recording ? 'Recording...' : voiceBlob ? 'Voice Attached' : 'Voice Memo'}
                </p>
                <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-tighter">
                  {recording ? `Status: ${recordingTime}s / 30s` : 'Add audio note'}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Image Cropper Modal */}
      {editingImage && (
        <ImageCropper
          imageSrc={editingImage.url}
          onCropComplete={(blob) => {
            const file = new File([blob], `edited_${Date.now()}.jpg`, { type: 'image/jpeg' });
            fileManager.updateFile(editingImage.id, { 
              file, 
              url: URL.createObjectURL(blob) 
            });
            setEditingImage(null);
            toast.success('Photo updated!');
          }}
          onCancel={() => setEditingImage(null)}
          aspectRatio={undefined}
        />
      )}

      {/* Video Editor Modal */}
      {editingVideo && (
        <VideoEditorModal
          videoFile={editingVideo.file}
          videoUrl={editingVideo.url}
          onDone={(result) => {
            setVideoEdits(prev => {
              const next = new Map(prev);
              next.set(editingVideo.id, result);
              return next;
            });
            setEditingVideo(null);
            toast.success('Video edited!');
          }}
          onCancel={() => setEditingVideo(null)}
        />
      )}
    </div>
  );
};

export default CreatePost;
