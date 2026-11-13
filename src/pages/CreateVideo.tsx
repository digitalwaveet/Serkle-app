import { useEffect, useMemo, useState } from "react";
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, FileVideo2, Image, Play, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useVideoMutations } from "@/hooks/useVideoMutations";
import { generateVideoThumbnail } from "@/lib/videoUtils";
import VideoThumbnailModal from "@/components/VideoThumbnailModal";
import { CustomFilePicker, useFileManager } from "@/components/CustomFilePicker";
import { cn } from "@/lib/utils";

const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const DRAFT_KEY = "serkle-create-video-draft";
const steps = [{ number: 1, label: "Choose" }, { number: 2, label: "Describe" }, { number: 3, label: "Review" }] as const;

const formatFileSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const getDraftValue = (key: 'title' | 'description' | 'tags') => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}")[key] || ""; } catch { return ""; }
};

const CreateVideo = () => {
  const navigate = useNavigate();
  const { createVideo } = useVideoMutations();
  const videoManager = useFileManager();
  const thumbManager = useFileManager();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [autoThumbFile, setAutoThumbFile] = useState<File | null>(null);
  const [autoThumbPreview, setAutoThumbPreview] = useState("");
  const [title, setTitle] = useState(() => getDraftValue('title'));
  const [description, setDescription] = useState(() => getDraftValue('description'));
  const [tags, setTags] = useState(() => getDraftValue('tags'));
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [isVideoThumbModalOpen, setIsVideoThumbModalOpen] = useState(false);

  const videoFileItem = videoManager.files[0];
  const thumbFileItem = thumbManager.files[0];
  const selectedVideoId = videoFileItem?.id;
  const selectedVideoKind = videoFileItem?.kind;
  const selectedVideoFile = videoFileItem?.file;
  const removeVideoFile = videoManager.removeFile;
  const poster = thumbFileItem?.url || autoThumbPreview;
  const tagList = useMemo(() => tags.split(',').map(tag => tag.trim()).filter(Boolean), [tags]);

  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, tags })); }, [title, description, tags]);

  useEffect(() => {
    let active = true;
    if (selectedVideoKind !== 'video' || !selectedVideoId || !selectedVideoFile) {
      setAutoThumbFile(null);
      setAutoThumbPreview("");
      return () => { active = false; };
    }
    const file = selectedVideoFile as File;
    if (file.size > MAX_VIDEO_SIZE) {
      toast.error("Video file size must be less than 100MB");
      removeVideoFile(selectedVideoId);
      return () => { active = false; };
    }
    setIsGeneratingThumbnail(true);
    generateVideoThumbnail(file)
      .then(thumb => {
        if (!active) return;
        setAutoThumbFile(new File([thumb.blob], `thumb_${file.name}.jpg`, { type: 'image/jpeg' }));
        setAutoThumbPreview(thumb.url);
      })
      .catch(error => {
        console.error('Failed to generate automatic thumbnail:', error);
        if (active) toast.error("We couldn't create a preview. You can still add a custom cover.");
      })
      .finally(() => { if (active) setIsGeneratingThumbnail(false); });
    return () => { active = false; };
  }, [removeVideoFile, selectedVideoFile, selectedVideoId, selectedVideoKind]);

  const exitCreator = () => navigate('/', { state: { feedMode: 'relax' } });
  const handleBack = () => {
    if (isUploading) return;
    if (step > 1) setStep(previous => (previous - 1) as 1 | 2);
    else exitCreator();
  };
  const continueFromChoose = () => videoFileItem ? setStep(2) : toast.error("Choose a video to continue");
  const continueFromDescribe = () => {
    if (!title.trim()) return toast.error("Add a title to continue");
    if (title.trim().length > 100) return toast.error("Title must be 100 characters or fewer");
    if (description.length > 500) return toast.error("Description must be 500 characters or fewer");
    setStep(3);
  };
  const handleSubmit = async () => {
    if (!videoFileItem || !title.trim() || isUploading) return;
    setIsUploading(true);
    try {
      const result = await createVideo({
        video: videoFileItem.file as File,
        thumbnail: (thumbFileItem?.file as File) || autoThumbFile || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tagList.length ? tagList : undefined,
      });
      if (result?.success) {
        localStorage.removeItem(DRAFT_KEY);
        navigate('/', { state: { feedMode: 'relax' } });
      }
    } finally { setIsUploading(false); }
  };

  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,hsl(var(--secondary)/0.16),transparent_36%),hsl(var(--background))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-2xl">
        <header className="sticky top-0 z-30 border-b border-primary/10 bg-background/[0.88] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <button type="button" onClick={handleBack} disabled={isUploading} className="grid size-12 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50" aria-label={step === 1 ? "Close video creator" : "Previous step"}>
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0 text-center"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/[0.65]">Serkle Relax</p><h1 className="truncate text-lg font-bold tracking-tight">Create video</h1></div>
            <div className="size-12" aria-hidden="true" />
          </div>
          <ol className="mt-3 grid grid-cols-3 gap-2" aria-label="Video creation progress">
            {steps.map(item => {
              const completed = step > item.number;
              const current = step === item.number;
              return <li key={item.number} aria-current={current ? "step" : undefined}>
                <div className={cn("mb-2 h-1 rounded-full transition-colors", step >= item.number ? "bg-primary" : "bg-primary/[0.12]")} />
                <div className={cn("flex items-center justify-center gap-1.5 text-xs font-semibold", current ? "text-primary" : completed ? "text-foreground" : "text-muted-foreground")}>
                  <span className={cn("grid size-5 place-items-center rounded-full text-[11px]", step >= item.number ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{completed ? <Check className="size-3" /> : item.number}</span>{item.label}
                </div>
              </li>;
            })}
          </ol>
        </header>

        <section className="px-4 py-6 sm:px-6" aria-live="polite">
          {step === 1 && <div className="animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="mb-6"><span className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary/[0.18] px-3 py-1.5 text-xs font-bold text-primary"><Sparkles className="size-3.5" /> Creator stage</span><h2 className="text-3xl font-black tracking-[-0.035em] text-foreground">Start with your video</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Choose a clip from your device. We’ll prepare a lightweight cover while you add the details.</p></div>
            {!videoFileItem ? <CustomFilePicker manager={videoManager} hideUploadButton hidePreviewList accept="video/*">
              <div className="group flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-[2rem] border border-dashed border-primary/[0.35] bg-card/[0.82] p-8 text-center shadow-[0_24px_70px_-45px_hsl(var(--primary)/0.65)] transition hover:-translate-y-0.5 hover:border-primary hover:bg-card">
                <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform group-hover:scale-105"><Upload className="size-7" /></div>
                <p className="text-xl font-extrabold tracking-tight">Choose a video</p><p className="mt-2 text-sm leading-6 text-muted-foreground">MP4, MOV, AVI or WebM · up to 100 MB</p><span className="mt-5 inline-flex min-h-11 items-center rounded-full bg-secondary/20 px-5 text-sm font-bold text-primary">Browse your device</span>
              </div>
            </CustomFilePicker> : <div className="overflow-hidden rounded-[2rem] border border-primary/10 bg-card shadow-[0_24px_70px_-45px_hsl(var(--primary)/0.65)]">
              <div className="relative aspect-[4/5] max-h-[58dvh] bg-black"><video src={videoFileItem.url} controls preload="metadata" className="h-full w-full object-contain" poster={poster || undefined} /><button type="button" onClick={() => videoManager.removeFile(videoFileItem.id)} className="absolute right-3 top-3 grid size-11 place-items-center rounded-full border border-white/[0.15] bg-black/[0.55] text-white backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Remove selected video"><X className="size-5" /></button></div>
              <div className="flex items-center gap-3 p-4"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary/[0.18] text-primary"><FileVideo2 className="size-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{videoFileItem.name}</p><p className="text-xs text-muted-foreground">{formatFileSize((videoFileItem.file as File).size)} · Ready to describe</p></div><Check className="size-5 text-primary" aria-hidden="true" /></div>
            </div>}
            <Button onClick={continueFromChoose} disabled={!videoFileItem} className="mt-6 min-h-[52px] w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/15">Continue <ChevronRight className="ml-1 size-5" /></Button>
          </div>}

          {step === 2 && <div className="animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="mb-6"><h2 className="text-3xl font-black tracking-[-0.035em]">Make it easy to discover</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">A clear title and a few helpful details give people a reason to watch.</p></div>
            <div className="mb-5 overflow-hidden rounded-[1.75rem] border border-primary/10 bg-card shadow-sm">
              <div className="relative aspect-video bg-black">{poster ? <img src={poster} alt="Video cover preview" className="h-full w-full object-cover" /> : <video src={videoFileItem?.url} muted preload="metadata" className="h-full w-full object-cover" />}<div className="absolute inset-0 grid place-items-center bg-black/10"><div className="grid size-12 place-items-center rounded-full border border-white/30 bg-black/[0.35] text-white backdrop-blur"><Play className="ml-0.5 size-5 fill-current" /></div></div>{isGeneratingThumbnail && <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/[0.65] p-2 text-xs font-semibold text-white"><SerkleLoader size="xs" dark label="Preparing cover" /> Preparing cover…</div>}<button type="button" onClick={() => setIsVideoThumbModalOpen(true)} className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-black/[0.55] px-4 text-xs font-bold text-white backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Image className="size-4" /> Edit cover</button></div>
              <div className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm font-bold">Cover image</p><p className="text-xs text-muted-foreground">Auto-generated from your video</p></div><CustomFilePicker manager={thumbManager} hideUploadButton hidePreviewList accept="image/*"><span className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-primary/[0.08] px-4 text-xs font-bold text-primary hover:bg-primary/[0.12]">Upload custom</span></CustomFilePicker></div>
            </div>
            <div className="space-y-5 rounded-[1.75rem] border border-primary/10 bg-card p-5 shadow-sm">
              <div className="space-y-2"><div className="flex items-center justify-between"><label htmlFor="video-title" className="text-sm font-bold">Title <span className="text-destructive">*</span></label><span className="text-xs tabular-nums text-muted-foreground">{title.length}/100</span></div><Input id="video-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="What should people know?" maxLength={100} className="min-h-12 rounded-xl border-primary/[0.15] bg-background text-base focus-visible:ring-primary" /></div>
              <div className="space-y-2"><div className="flex items-center justify-between"><label htmlFor="video-description" className="text-sm font-bold">Description <span className="font-normal text-muted-foreground">Optional</span></label><span className="text-xs tabular-nums text-muted-foreground">{description.length}/500</span></div><Textarea id="video-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Add context, a story, or a question…" maxLength={500} rows={5} className="resize-none rounded-xl border-primary/[0.15] bg-background text-base focus-visible:ring-primary" /></div>
              <div className="space-y-2"><label htmlFor="video-tags" className="text-sm font-bold">Tags <span className="font-normal text-muted-foreground">Optional</span></label><Input id="video-tags" value={tags} onChange={event => setTags(event.target.value)} placeholder="wellness, music, tutorial" className="min-h-12 rounded-xl border-primary/[0.15] bg-background text-base focus-visible:ring-primary" /><p className="text-xs leading-5 text-muted-foreground">Separate tags with commas. Use only words that describe this video.</p></div>
            </div>
            <Button onClick={continueFromDescribe} disabled={!title.trim()} className="mt-6 min-h-[52px] w-full rounded-2xl text-base font-bold">Review video <ChevronRight className="ml-1 size-5" /></Button>
          </div>}

          {step === 3 && <div className="animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="mb-6"><h2 className="text-3xl font-black tracking-[-0.035em]">Ready for Relax?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Check everything once more. Your video is only posted when you tap Publish.</p></div>
            <article className="overflow-hidden rounded-[2rem] border border-primary/10 bg-card shadow-[0_24px_70px_-45px_hsl(var(--primary)/0.65)]"><div className="relative aspect-[4/5] max-h-[58dvh] bg-black"><video src={videoFileItem?.url} controls preload="metadata" poster={poster || undefined} className="h-full w-full object-contain" /></div><div className="space-y-3 p-5"><h3 className="text-xl font-extrabold leading-tight">{title.trim()}</h3>{description.trim() && <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{description.trim()}</p>}{tagList.length > 0 && <div className="flex flex-wrap gap-2">{tagList.map(tag => <span key={tag} className="rounded-full bg-secondary/[0.18] px-3 py-1.5 text-xs font-bold text-primary">#{tag}</span>)}</div>}</div></article>
            <div className="mt-5 rounded-2xl border border-primary/10 bg-primary/[0.04] p-4 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Before you publish:</strong> keep this screen open until the upload completes. We’ll return you to Relax when your video is ready.</div>
            <div className="mt-6 grid grid-cols-[0.7fr_1.3fr] gap-3"><Button variant="outline" onClick={() => setStep(2)} disabled={isUploading} className="min-h-[52px] rounded-2xl border-primary/20 font-bold">Edit</Button><Button onClick={handleSubmit} disabled={isUploading} className="min-h-[52px] rounded-2xl font-bold shadow-lg shadow-primary/15">{isUploading ? <><SerkleLoader size="xs" className="mr-2 text-current" label="Publishing video" /> Publishing…</> : <><Upload className="mr-2 size-4" /> Publish video</>}</Button></div>
          </div>}
        </section>
      </div>
      {videoFileItem && <VideoThumbnailModal isOpen={isVideoThumbModalOpen} onClose={() => setIsVideoThumbModalOpen(false)} videoFile={videoFileItem.file as File} onSelect={(blob, url) => { setAutoThumbFile(new File([blob], `thumb_${videoFileItem.name}.jpg`, { type: 'image/jpeg' })); setAutoThumbPreview(url); if (thumbFileItem) thumbManager.removeFile(thumbFileItem.id); setIsVideoThumbModalOpen(false); toast.success('Cover updated'); }} />}
    </main>
  );
};

export default CreateVideo;
