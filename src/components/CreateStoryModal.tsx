import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Type, X } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';
import StoryEditor from '@/components/story/StoryEditor';
import { StoryDialog } from '@/components/story/StoryDialog';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { storyService } from '@/services/storyService';
import { inspectStoryFile, STORY_MEDIA_ACCEPT } from '@/lib/storyMedia';
import { EditorExtraData } from '@/types/storyTypes';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateStory: (storyData: { id: string } | null) => void;
}

function StoryComposer({ onClose, onCreateStory }: Omit<CreateStoryModalProps, 'isOpen'>) {
  const { user } = useUser();
  const [media, setMedia] = useState<{ url: string; type: 'image' | 'video'; text?: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const operation = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current++; }; }, []);
  useEffect(() => () => { if (media) URL.revokeObjectURL(media.url); }, [media]);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    const version = ++operation.current;
    setChecking(true); setError('');
    try {
      const type = await inspectStoryFile(file);
      if (mounted.current && version === operation.current) setMedia({ url: URL.createObjectURL(file), type });
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not open this file.');
    } finally { if (mounted.current) setChecking(false); }
  };

  const startText = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1920;
    const context = canvas.getContext('2d');
    if (!context) { setError('Your device could not open the story canvas.'); return; }
    const gradient = context.createLinearGradient(0, 0, 1080, 1920);
    gradient.addColorStop(0, '#6342bc'); gradient.addColorStop(0.55, '#b63788'); gradient.addColorStop(1, '#f19753');
    context.fillStyle = gradient; context.fillRect(0, 0, 1080, 1920);
    canvas.toBlob(blob => { if (blob && mounted.current) setMedia({ url: URL.createObjectURL(blob), type: 'image', text: true }); }, 'image/jpeg', .92);
  };

  if (media) return <StoryEditor previewUrl={media.url} mediaType={media.type} startWithText={media.text}
    onCancel={() => setMedia(null)} onDone={async (blob: Blob, mentions?: string[], extra?: EditorExtraData) => {
      if (!user?.id) throw new Error('Please sign in again before sharing your story.');
      // Keep the editor and object URLs alive until the entire publish succeeds.
      const result = await storyService.createStory(user.id, blob, media.type === 'video', mentions, extra);
      toast({ title: 'Your story is live', description: result.mentionsSaved ? 'Shared for the next 24 hours.' : 'Shared successfully, but mentions could not be saved.' });
      onCreateStory(result);
      onClose();
    }} />;

  return <StoryDialog title="Add to story" onClose={onClose} className="story-start">
    <header><button className="studio-icon" aria-label="Close story creator" onClick={onClose}><X size={25} /></button><h1>Add to story</h1><span /></header>
    <div className="story-start-body">
      <div className="story-create-options">
        <button className="story-create-card" disabled={checking} onClick={() => cameraInput.current?.click()}><Camera /><strong>Camera</strong></button>
        <button className="story-create-card story-create-card--text" disabled={checking} onClick={startText}><span className="text-[30px] leading-none font-semibold">Aa</span><strong>Create</strong></button>
      </div>
      <div className="flex items-center justify-between pb-4"><h2 className="text-base font-semibold">Photos and videos</h2><ImagePlus size={20} /></div>
      <div className="story-library">
        <div className="story-library-icon"><ImagePlus size={32} strokeWidth={1.5} /></div>
        <h2>Add a moment to your story</h2>
        <p>Choose a photo or video from your device to get started.</p>
        <button className="story-primary" disabled={checking} onClick={() => input.current?.click()}>Select from device</button>
      </div>
      <input ref={input} type="file" accept={STORY_MEDIA_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Choose story media" onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = ''; }} />
      <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-label="Take story photo" onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = ''; }} />
      {checking && <div className="py-4" role="status"><SerkleLoader dark size="sm" label="Opening your media" showText /></div>}
      {error && <p className="story-error mb-4" role="alert">{error}</p>}
      <p className="story-media-note">Photos up to 15 MB · Videos up to 60 seconds / 50 MB<br />Visible in your story for 24 hours</p>
    </div>
  </StoryDialog>;
}

export default function CreateStoryModal({ isOpen, ...props }: CreateStoryModalProps) {
  return isOpen ? <StoryComposer {...props} /> : null;
}
