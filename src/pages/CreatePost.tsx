import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { readShareDraft, removeShareDraft } from '@/lib/shareDraft';
import { ArrowLeft, MapPin, Users, Globe, Image, Video, Mic, X, Pencil, FileText, Check, Sparkles, Search } from 'lucide-react';
import ImageCropper from '@/components/ImageCropper';
import VideoEditorModal from '@/components/VideoEditorModal';
import { InlineVideoLoader } from '@/components/ui/VideoLoader';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/contexts/UserContext';
import { usePostMutations } from '@/hooks/usePostMutations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MentionTextarea from '@/components/MentionTextarea';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';
import { PDFPreview } from '@/components/post/PDFPreview';
import { canPublishPostDraft, createPostType, fileRevision } from '@/lib/createPostDraft';
import { detectCurrentPosition, locationErrorMessage, reverseGeocodeLocation, searchLocationSuggestions, type LocationSuggestion } from '@/lib/locationSearch';

const CreatePost: React.FC<{ shareId?: string }> = ({ shareId }) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { createPost, isCreating } = usePostMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishStage, setPublishStage] = useState<'idle' | 'preparing' | 'uploading' | 'publishing'>('idle');
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
  const [locationDraft, setLocationDraft] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [locationDetectionMessage, setLocationDetectionMessage] = useState<string | null>(null);
  const [locationSelectionMade, setLocationSelectionMade] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!voiceBlob) {
      setVoicePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(voiceBlob);
    setVoicePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [voiceBlob]);

  useEffect(() => {
    const query = locationDraft.trim();
    if (!locationPickerOpen || locationSelectionMade || query.length < 2) {
      setLocationSuggestions([]);
      setSearchingLocations(false);
      setLocationSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchingLocations(true);
      setLocationSearchError(null);
      try {
        setLocationSuggestions(await searchLocationSuggestions(query, controller.signal));
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setLocationSuggestions([]);
          setLocationSearchError('Location search is temporarily unavailable. You can still enter a location manually.');
        }
      } finally {
        if (!controller.signal.aborted) setSearchingLocations(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locationDraft, locationPickerOpen, locationSelectionMade]);

  const handleAddLocation = async () => {
    if (!navigator.geolocation) {
      setLocationDetectionMessage('Current location is not supported on this device. Search for a place instead.');
      return;
    }
    setLoadingLocation(true);
    setLocationDetectionMessage('Requesting location access…');
    setLocationSearchError(null);
    try {
      if (navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          if (permission.state === 'denied') {
            setLocationDetectionMessage('Location permission is blocked. Enable it for Serkle in your browser settings, then try again.');
            return;
          }
        } catch {
          // Some mobile browsers expose Permissions API but do not support geolocation queries.
        }
      }

      const position = await detectCurrentPosition(navigator.geolocation);
      const { latitude, longitude } = position.coords;
      let readable = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      try {
        readable = await reverseGeocodeLocation(latitude, longitude);
      } catch {
        // Coordinates are still a valid fallback when reverse geocoding is unavailable.
      }
      setLocationDraft(readable.slice(0, 160));
      setLocationSelectionMade(true);
      setLocationSuggestions([]);
      setLocationDetectionMessage('Current location detected. Tap Add location to attach it to your post.');
    } catch (error) {
      setLocationDetectionMessage(locationErrorMessage(error as GeolocationPositionError));
    } finally {
      setLoadingLocation(false);
    }
  };

  const openLocationPicker = () => {
    setLocationDraft(locationText || '');
    setLocationSelectionMade(Boolean(locationText));
    setLocationSuggestions([]);
    setLocationSearchError(null);
    setLocationDetectionMessage(null);
    setLocationPickerOpen(true);
  };

  const selectLocationSuggestion = (suggestion: LocationSuggestion) => {
    setLocationDraft(suggestion.fullName.slice(0, 160));
    setLocationSelectionMade(true);
    setLocationSuggestions([]);
    setLocationSearchError(null);
    setLocationDetectionMessage('Location selected.');
  };

  const saveManualLocation = () => {
    const next = locationDraft.trim();
    if (!next) {
      toast.error('Enter a location or use your current location');
      return;
    }
    setLocationText(next.slice(0, 160));
    setLocationPickerOpen(false);
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
    if (shareState !== 'ready' || isSubmitting || isCreating || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setPublishStage('preparing');

    // Reuse the same key when retrying the same draft after an uncertain
    // network result. Any edited draft gets a fresh key.
    const snapshot = JSON.stringify({
      text: postText,
      privacy,
      locationText,
      files: fileManager.files.map(item => [
        item.name,
        item.size,
        fileRevision(item.file),
      ]),
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
        setPublishStage('uploading');
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

      setPublishStage('publishing');
      await createPost(
        {
          content: postText,
          media: mediaFiles,
          locationText: locationText || undefined,
          voiceUrl,
          coverImage,
          postType: createPostType(fileManager.files, Boolean(pdfFile)),
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
      setIsSubmitting(false);
      setPublishStage('idle');
    }
  };

  const privacyOptions = [
    { value: 'public', label: 'Public', icon: Globe },
    { value: 'friends', label: 'Friends', icon: Users },
  ];

  const isPublishing = isSubmitting || isCreating;
  const composerDisabled = isPublishing || shareState !== 'ready';
  const canPublish = canPublishPostDraft({
    text: postText,
    mediaCount: fileManager.files.length,
    hasPdf: Boolean(pdfFile),
    hasVoice: Boolean(voiceBlob),
    creating: isPublishing,
    shareReady: shareState === 'ready',
  });
  const imageCount = fileManager.files.filter((item) => item.kind === 'image').length;
  const videoCount = fileManager.files.filter((item) => item.kind === 'video').length;
  const hasAttachments =
    (isPreviewMode && pdfPages.length > 0) ||
    fileManager.files.length > 0 ||
    Boolean(locationText) ||
    recording ||
    Boolean(voiceBlob) ||
    isProcessingPdf;
  const toolStatusHint = pdfFile
    ? 'Remove PDF to attach photos or videos'
    : fileManager.files.length > 0
      ? `${fileManager.files.length} media ${fileManager.files.length === 1 ? 'item' : 'items'} attached`
      : null;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-muted/30">
      <header className="sticky top-0 z-30 shrink-0 border-b border-border/70 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-2xl items-center justify-between gap-2 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => navigate('/')}
            disabled={isPublishing}
            aria-label="Back to home"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 sm:px-3"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">Create post</h1>
            <p className="truncate text-[11px] font-medium text-muted-foreground">Share with your Serkle</p>
          </div>
          <Button
            onClick={handlePost}
            disabled={!canPublish}
            className="h-10 min-w-[78px] rounded-full px-5 text-sm font-bold shadow-sm transition-all disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none"
            aria-label={isPublishing ? 'Publishing post' : 'Publish post'}
          >
            {isPublishing ? <span className="flex items-center gap-2"><InlineVideoLoader />Posting</span> : 'Post'}
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3.5 px-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3.5 sm:gap-4 sm:px-5 sm:py-5">
        {shareId && (
          <section className="shrink-0 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm" aria-live="polite">
            <p>{shareState === 'loading' ? 'Preparing your shared draft…' : shareState === 'error' ? 'This shared draft expired, is unavailable, or belongs to another account.' : 'Shared draft ready. Review the content and audience before posting.'}</p>
            <Button variant="ghost" className="mt-2 h-10 px-3" disabled={isPublishing} onClick={async () => {
              try { if (user) await removeShareDraft(shareId, user.id); navigate('/'); }
              catch { toast.error('Could not discard the draft. Please try again.'); }
            }}>Discard shared draft</Button>
          </section>
        )}

        {/* Composer Card — owns the primary vertical space gracefully on mobile and desktop */}
        <section
          aria-label="Post composer"
          className="flex flex-1 flex-col rounded-[1.5rem] border border-border/80 bg-card shadow-[0_14px_38px_-28px_rgba(73,40,23,0.42)] sm:flex-none sm:min-h-[340px]"
        >
          {/* Author + Audience Bar */}
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
            <Avatar className="size-11 shrink-0 border border-primary/15 shadow-sm">
              <AvatarImage src={user?.avatar} alt={user?.name} />
              <AvatarFallback className="bg-primary font-bold text-primary-foreground">{user?.initials || 'U'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-snug text-foreground">{user?.name || 'Your Name'}</p>
              <div
                className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/60 p-0.5"
                role="group"
                aria-label="Post audience"
              >
                {privacyOptions.map((option) => {
                  const IconComponent = option.icon;
                  const selected = privacy === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setPrivacy(option.value as 'public' | 'friends')}
                      disabled={composerDisabled}
                      aria-pressed={selected}
                      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                        selected
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      } disabled:opacity-50`}
                    >
                      <IconComponent className="size-3.5" aria-hidden="true" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Spacious Writing Surface */}
          <div
            className="flex flex-1 cursor-text flex-col px-4 pb-3 pt-4"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('button, a, input, textarea, audio')) return;
              textareaRef.current?.focus();
            }}
          >
            <MentionTextarea
              textareaRef={textareaRef}
              placeholder="What would you like to share?"
              value={postText}
              onChange={setPostText}
              disabled={composerDisabled}
              ariaLabel="Post text"
              className="w-full min-h-[168px] border-none bg-transparent p-0 text-[17px] leading-relaxed text-foreground outline-none resize-none placeholder:text-muted-foreground/75 disabled:opacity-60 sm:min-h-[196px] sm:text-[18px]"
              dir="auto"
              rows={6}
            />
          </div>

          {/* Subtle Composer Footer Meta */}
          <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-1 text-[11px] font-medium text-muted-foreground">
            <span>Type @ to mention friends</span>
            {postText.length > 0 && (
              <span aria-live="polite" className="tabular-nums">
                {postText.length} {postText.length === 1 ? 'char' : 'chars'}
              </span>
            )}
          </div>

          {/* Unified Attachments Area inside the Composer Card */}
          {hasAttachments && (
            <div className="space-y-3 border-t border-border/60 p-3.5">
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
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="mb-2.5 flex items-center justify-between px-0.5">
                    <h2 className="text-xs font-bold text-foreground">Media</h2>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      {fileManager.files.length} {fileManager.files.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className={`grid gap-2.5 ${fileManager.files.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {fileManager.files.map((item) => (
                      <article
                        key={item.id}
                        className={`group relative overflow-hidden rounded-2xl border border-border/70 bg-muted ${
                          fileManager.files.length === 1 ? 'aspect-[16/10]' : 'aspect-square'
                        }`}
                      >
                        {item.kind === 'video' ? (
                          <video src={item.url} className="size-full object-cover" muted playsInline preload="metadata" />
                        ) : (
                          <img src={item.url} className="size-full object-cover" alt={`Preview of ${item.name}`} />
                        )}
                        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/55 to-transparent p-2">
                          <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                            {item.kind}
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => item.kind === 'image'
                                ? setEditingImage({ id: item.id, url: item.url })
                                : setEditingVideo({ id: item.id, url: item.url, file: item.file as File })}
                              disabled={composerDisabled}
                              aria-label={`Edit ${item.kind}`}
                              className="inline-flex size-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => fileManager.removeFile(item.id)}
                              disabled={composerDisabled}
                              aria-label={`Remove ${item.name}`}
                              className="inline-flex size-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                            >
                              <X className="size-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        {videoEdits.has(item.id) && (
                          <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow">
                            <Check className="size-3" aria-hidden="true" /> Edited
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {(locationText || recording || voiceBlob || isProcessingPdf) && (
                <div className="space-y-2" aria-label="Post additions">
                  {locationText && (
                    <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><MapPin className="size-4" aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1"><p className="text-xs font-bold text-foreground">Location added</p><p className="truncate text-xs text-muted-foreground">{locationText}</p></div>
                      <button type="button" onClick={() => setLocationText(null)} disabled={composerDisabled} aria-label="Remove location" className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" aria-hidden="true" /></button>
                    </div>
                  )}
                  {recording && (
                    <button type="button" onClick={stopRecording} className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-left transition hover:bg-destructive/10 active:scale-[0.99]" aria-label={`Stop voice recording. ${recordingTime} seconds recorded`}>
                      <span className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive"><span className="absolute size-2 animate-ping rounded-full bg-destructive" /><Mic className="size-4" aria-hidden="true" /></span>
                      <div className="flex-1"><p className="text-xs font-bold text-foreground">Recording voice memo</p><p className="text-xs text-muted-foreground" aria-live="polite">{recordingTime}s of 30s · tap here or Voice to stop</p></div>
                    </button>
                  )}
                  {voiceBlob && !recording && voicePreviewUrl && (
                    <div className="flex min-h-14 items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Mic className="size-4" aria-hidden="true" /></span>
                      <audio src={voicePreviewUrl} controls className="h-9 min-w-0 flex-1" aria-label="Voice memo preview" />
                      <button type="button" onClick={() => setVoiceBlob(null)} disabled={composerDisabled} aria-label="Remove voice memo" className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" aria-hidden="true" /></button>
                    </div>
                  )}
                  {isProcessingPdf && (
                    <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5" role="status" aria-live="polite">
                      <SerkleLoader size="xs" className="text-amber-600 dark:text-amber-400" />
                      <div><p className="text-xs font-bold text-foreground">Preparing document preview</p><p className="text-xs text-muted-foreground">Page {pdfProgress.current} of {pdfProgress.total || '…'}</p></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {isPublishing && (
          <section className="shrink-0 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4" role="status" aria-live="assertive">
            <SerkleLoader size="sm" className="text-primary" />
            <div><p className="text-sm font-bold text-foreground">{publishStage === 'preparing' ? 'Preparing your post' : publishStage === 'uploading' ? 'Uploading media' : 'Publishing your post'}</p><p className="text-xs text-muted-foreground">Keep this screen open. A repeated tap cannot create a duplicate.</p></div>
          </section>
        )}

        {/* Balanced, Accessible Post Tools Card */}
        <section
          aria-label="Add to your post"
          className="shrink-0 rounded-[1.5rem] border border-border/80 bg-card p-3.5 shadow-[0_10px_30px_-22px_rgba(73,40,23,0.35)] sm:p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-3.5" aria-hidden="true" />
              </span>
              <h2 className="text-xs font-bold tracking-wide text-foreground">Add to your post</h2>
            </div>
            {toolStatusHint && (
              <span className="truncate text-[11px] font-medium text-muted-foreground">
                {toolStatusHint}
              </span>
            )}
          </div>

          <div className="space-y-2.5" role="toolbar" aria-label="Post tools">
            {/* Primary visual media row */}
            <div className="grid grid-cols-2 gap-2.5">
              <CustomFilePicker manager={fileManager} hideUploadButton hidePreviewList accept="image/*" multiple maxFiles={10} disabled={!!pdfFile || composerDisabled}>
                <button
                  type="button"
                  disabled={!!pdfFile || composerDisabled}
                  aria-label="Add photos"
                  className="flex min-h-[58px] w-full items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.05] px-3.5 py-2.5 text-left transition hover:border-primary/30 hover:bg-primary/[0.09] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40"
                >
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Image className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight text-foreground">Photo</span>
                    <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">
                      {imageCount > 0 ? `${imageCount} selected` : 'Up to 10'}
                    </span>
                  </span>
                </button>
              </CustomFilePicker>

              <CustomFilePicker manager={fileManager} hideUploadButton hidePreviewList accept="video/*" multiple maxFiles={5} disabled={!!pdfFile || composerDisabled}>
                <button
                  type="button"
                  disabled={!!pdfFile || composerDisabled}
                  aria-label="Add videos"
                  className="flex min-h-[58px] w-full items-center gap-3 rounded-2xl border border-[#4F69C4]/20 bg-[#4F69C4]/[0.06] px-3.5 py-2.5 text-left transition hover:border-[#4F69C4]/35 hover:bg-[#4F69C4]/[0.11] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40"
                >
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#4F69C4]/15 text-[#4F69C4] dark:text-[#86A0FF]">
                    <Video className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight text-foreground">Video</span>
                    <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">
                      {videoCount > 0 ? `${videoCount} selected` : 'Up to 5'}
                    </span>
                  </span>
                </button>
              </CustomFilePicker>
            </div>

            {/* Secondary enrichment tools row */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <input type="file" id="pdf-upload" accept="application/pdf" className="sr-only" onChange={handlePdfUpload} disabled={fileManager.files.length > 0 || isProcessingPdf || composerDisabled} />
                <button
                  type="button"
                  onClick={() => document.getElementById('pdf-upload')?.click()}
                  disabled={fileManager.files.length > 0 || isProcessingPdf || composerDisabled}
                  aria-label="Add PDF file"
                  aria-pressed={Boolean(pdfFile)}
                  className={`flex min-h-[64px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 ${
                    pdfFile
                      ? 'border-amber-500/40 bg-amber-500/15'
                      : 'border-border/75 bg-muted/35 hover:border-amber-500/30 hover:bg-amber-500/[0.07]'
                  }`}
                >
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <FileText className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-foreground">{pdfFile ? 'PDF added' : 'PDF File'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={openLocationPicker}
                disabled={loadingLocation || composerDisabled}
                aria-pressed={!!locationText}
                aria-label={locationText ? 'Edit location' : 'Add location'}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 ${
                  locationText
                    ? 'border-primary/35 bg-primary/10'
                    : 'border-border/75 bg-muted/35 hover:border-emerald-500/30 hover:bg-emerald-500/[0.07]'
                }`}
              >
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  {loadingLocation ? <SerkleLoader size="xs" className="text-current" /> : <MapPin className="size-4" aria-hidden="true" />}
                </span>
                <span className="text-xs font-semibold text-foreground">{locationText ? 'Location ✓' : 'Location'}</span>
              </button>

              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={(!!voiceBlob && !recording) || composerDisabled}
                aria-pressed={recording}
                aria-label={recording ? 'Stop voice recording' : 'Record voice memo'}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 ${
                  recording
                    ? 'border-destructive/40 bg-destructive/10'
                    : voiceBlob
                      ? 'border-primary/35 bg-primary/10'
                      : 'border-border/75 bg-muted/35 hover:border-violet-500/30 hover:bg-violet-500/[0.07]'
                }`}
              >
                <span className={`inline-flex size-8 items-center justify-center rounded-full ${
                  recording
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                }`}>
                  <Mic className="size-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {recording ? `Stop (${recordingTime}s)` : voiceBlob ? 'Voice ✓' : 'Voice'}
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <Dialog open={locationPickerOpen} onOpenChange={open => !loadingLocation && setLocationPickerOpen(open)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-[1.75rem] p-5">
          <DialogHeader className="text-left">
            <DialogTitle>Add a location</DialogTitle>
            <DialogDescription>Type a place name, or choose your current location. You control what appears on the post.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label htmlFor="post-location" className="text-sm font-semibold text-foreground">Location name</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 z-10 size-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="post-location"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={locationSuggestions.length > 0}
                aria-controls="post-location-suggestions"
                value={locationDraft}
                onChange={event => {
                  setLocationDraft(event.target.value);
                  setLocationSelectionMade(false);
                  setLocationDetectionMessage(null);
                }}
                onKeyDown={event => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  if (locationSuggestions[0]) selectLocationSuggestion(locationSuggestions[0]);
                  else saveManualLocation();
                }}
                placeholder="Search city, neighborhood, or place"
                maxLength={160}
                autoFocus
                className="h-12 rounded-xl pl-10 pr-10"
              />
              {searchingLocations && <SerkleLoader size="xs" className="absolute right-3 top-3.5 text-primary" />}
            </div>
            {locationSuggestions.length > 0 && (
              <div id="post-location-suggestions" role="listbox" aria-label="Location suggestions" className="max-h-56 overflow-y-auto rounded-2xl border border-border bg-background p-1 shadow-lg">
                {locationSuggestions.map(suggestion => (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    key={suggestion.id}
                    onClick={() => selectLocationSuggestion(suggestion)}
                    className="flex min-h-12 w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted active:bg-muted"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0"><span className="block text-sm font-semibold text-foreground">{suggestion.label}</span>{suggestion.fullName !== suggestion.label && <span className="block truncate text-xs text-muted-foreground">{suggestion.fullName}</span>}</span>
                  </button>
                ))}
              </div>
            )}
            {!searchingLocations && !locationSelectionMade && locationDraft.trim().length >= 2 && locationSuggestions.length === 0 && !locationSearchError && (
              <p className="text-xs text-muted-foreground">No matching places yet. You can keep typing or add this name manually.</p>
            )}
            {locationSearchError && <p className="text-xs text-destructive" role="alert">{locationSearchError}</p>}
            <Button type="button" variant="outline" onClick={handleAddLocation} disabled={loadingLocation} className="h-12 w-full justify-start rounded-xl">
              {loadingLocation ? <SerkleLoader size="xs" className="mr-2 text-current" /> : <MapPin className="mr-2 size-4" />}
              {loadingLocation ? 'Finding your location…' : 'Use current location'}
            </Button>
            {locationDetectionMessage && (
              <p className={`rounded-xl px-3 py-2 text-xs ${locationDetectionMessage.includes('detected') || locationDetectionMessage === 'Location selected.' ? 'bg-primary/8 text-primary' : 'bg-muted text-muted-foreground'}`} role="status" aria-live="polite">{locationDetectionMessage}</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {locationText && <Button type="button" variant="ghost" onClick={() => { setLocationText(null); setLocationDraft(''); setLocationPickerOpen(false); }} className="mr-auto">Remove</Button>}
            <Button type="button" variant="outline" onClick={() => setLocationPickerOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveManualLocation} disabled={!locationDraft.trim() || loadingLocation}>Add location</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          aspectRatio={null}
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
