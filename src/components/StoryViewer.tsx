import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Story, PauseReason } from '@/types/storyTypes';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';
import { storyService } from '@/services/storyService';
import { shareStory } from '@/utils/shareUtils';
import { StoryProgressBar } from './story/StoryProgressBar';
import { StoryHeader } from './story/StoryHeader';
import { StoryMediaRenderer } from './story/StoryMediaRenderer';
import { StoryInteractiveOverlay } from './story/StoryInteractiveOverlay';
import { StoryLinkOverlay, StoryStickers } from './story/StoryLinkOverlay';
import { StoryBottomBar } from './story/StoryBottomBar';
import { StoryDialog } from './story/StoryDialog';
import { SerkleLoader } from './ui/SerkleLoader';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';
import StoryActivityModal from './StoryActivityModal';
import PublicProfileModal from './PublicProfileModal';
import { StoryReportDialog } from './story/StoryReportDialog';

interface StoryViewerProps {
  stories: Story[]; initialIndex: number; isOpen: boolean; onClose: () => void;
  onStoryViewed?: (storyId: string) => void;
}

function ActiveStoryViewer({ stories, initialIndex, onClose, onStoryViewed }: Omit<StoryViewerProps, 'isOpen'>) {
  const { user } = useUser();
  const navigate = useNavigate();
  const [storyId, setStoryId] = useState(stories[Math.max(0, initialIndex)]?.id ?? stories[0]?.id);
  const index = stories.findIndex(story => story.id === storyId);
  const story = stories[index];
  const dbId = typeof story?.id === 'string' && /^[0-9a-f-]{36}$/i.test(story.id) ? story.id : null;
  const own = !!user?.id && story?.user.id === user.id;
  const [pauses, setPauses] = useState<Set<PauseReason>>(new Set());
  const pause = useCallback((reason: PauseReason) => setPauses(current => current.has(reason) ? current : new Set([...current, reason])), []);
  const resume = useCallback((reason: PauseReason) => setPauses(current => { if (!current.has(reason)) return current; const next = new Set(current); next.delete(reason); return next; }), []);
  const [muted, setMuted] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const mediaKey = `${storyId}:${attempt}`;
  const [media, setMedia] = useState<{ key: string; status: 'loading' | 'ready' | 'error' }>({ key: '', status: 'loading' });
  const status = media.key === mediaKey ? media.status : 'loading';
  const paused = pauses.size > 0 || status !== 'ready';
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const [activity, setActivity] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const [links, setLinks] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'hide' | null>(null);
  const [removing, setRemoving] = useState(false);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const likeLock = useRef(false);
  const [resharing, setResharing] = useState(false);
  const reshareLock = useRef(false);
  const [mentions, setMentions] = useState<Array<{ user_id: string; username: string; name: string }>>([]);
  const viewed = useRef(new Set<string>());
  const [swipe, setSwipe] = useState({ y: 0, active: false });
  const next = useCallback(() => { if (stories[index + 1]) setStoryId(stories[index + 1].id); else onClose(); }, [index, stories, onClose]);
  const previous = useCallback(() => { if (stories[index - 1]) setStoryId(stories[index - 1].id); else { elapsed.current = 0; setProgress(0); if (video.current) video.current.currentTime = 0; } }, [index, stories]);
  const latestNext = useRef(next);
  latestNext.current = next;
  const showProfile = (id: string) => { setProfileId(id); pause('profile'); };

  useEffect(() => { elapsed.current = 0; setProgress(0); setLiked(false); setMentions([]); setSwipe({ y: 0, active: false }); }, [storyId, attempt]);
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setMedia({ key: mediaKey, status: 'error' }), 15000);
    return () => clearTimeout(timer);
  }, [mediaKey, status]);
  useEffect(() => {
    const change = () => document.hidden ? pause('visibility') : resume('visibility');
    change(); document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, [pause, resume]);
  useEffect(() => {
    if (!video.current) return;
    if (paused) video.current.pause();
    else void video.current.play().catch(() => { pause('manual'); });
  }, [paused, mediaKey, pause]);
  useEffect(() => {
    if (paused || !story) return;
    let frame: number;
    let last: number | null = null;
    const tick = (time: number) => {
      if (last !== null) elapsed.current += Math.min(time - last, 250);
      last = time;
      const duration = video.current?.duration;
      const value = story.mediaType === 'video' && video.current && duration && Number.isFinite(duration)
        ? video.current.currentTime / Math.min(duration, 60) * 100 : elapsed.current / 6000 * 100;
      setProgress(Math.min(value, 100));
      if (value >= 99.9 || video.current?.ended) { latestNext.current(); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, storyId, story?.mediaType, attempt]);

  useEffect(() => {
    if (!dbId || !user?.id || own || paused || viewed.current.has(dbId)) return;
    const timer = setTimeout(() => {
      void storyService.markStoryViewed(dbId, user.id).then(() => { viewed.current.add(dbId); onStoryViewed?.(dbId); }).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [dbId, user?.id, own, paused, onStoryViewed]);
  useEffect(() => {
    if (!dbId || !user?.id) return;
    let cancelled = false;
    void storyService.checkHasLiked(dbId, user.id).then(value => { if (!cancelled) setLiked(value); }).catch(() => {});
    void storyService.fetchStoryMentions(dbId).then(value => { if (!cancelled) setMentions(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, [dbId, user?.id]);

  useEffect(() => {
    if (!story) return;
    const keyboard = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input,textarea,button,a,select,[contenteditable=true],[role=menuitem]') || pauses.has('activity') || pauses.has('profile') || pauses.has('report') || pauses.has('confirm')) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
      if (event.key === ' ') { event.preventDefault(); pauses.has('manual') ? resume('manual') : pause('manual'); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [next, previous, pauses, pause, resume, story]);

  const removeStory = async () => {
    if (!dbId || !own || removing) return;
    setRemoving(true);
    try {
      const result = confirm === 'delete' ? await storyService.deleteStory(dbId) : await storyService.hideStory(dbId);
      if (result.error) throw result.error;
      toast({ title: confirm === 'delete' ? 'Story deleted' : 'Story ended' });
      onClose();
    } catch { toast({ title: 'Could not update your story', description: 'Please try again.', variant: 'destructive' }); }
    finally { setRemoving(false); setConfirm(null); resume('confirm'); }
  };
  const toggleLike = async () => {
    if (!dbId || !user?.id || likeLock.current) return;
    const previousValue = liked;
    likeLock.current = true; setLiking(true); setLiked(!liked);
    try { await storyService.toggleLike(dbId, user.id, !liked); }
    catch { setLiked(previousValue); toast({ title: 'Could not save your reaction', variant: 'destructive' }); }
    finally { likeLock.current = false; setLiking(false); }
  };
  const reshare = async () => {
    if (!dbId || !user?.id || !story || reshareLock.current) return;
    reshareLock.current = true; setResharing(true);
    try {
      const result = await storyService.reshareStory(dbId, user.id, story.image, story.mediaType || 'image', story.story_state);
      if (result.error) throw result.error;
      toast({ title: 'Added to your story' });
    } catch { toast({ title: 'Could not reshare this story', variant: 'destructive' }); }
    finally { reshareLock.current = false; setResharing(false); }
  };

  if (!story) return <StoryDialog title="Story unavailable" onClose={onClose} className="story-viewer"><div className="story-viewer-error"><p>This story is no longer available.</p><button className="story-primary" onClick={onClose}>Back to Serkle</button></div></StoryDialog>;
  const group = stories.filter(item => item.user.id === story.user.id);
  const groupIndex = group.findIndex(item => item.id === story.id);
  const requestConfirm = (action: 'delete' | 'hide') => { setConfirm(action); pause('confirm'); };
  return <StoryDialog title={`Story by ${story.user.name}`} onClose={() => { if (!removing) onClose(); }} className="story-viewer">
    <div className="story-viewer-stage">
      <div className="sr-only" aria-live="polite">Story {groupIndex + 1} of {group.length} by {story.user.name}</div>
      <StoryInteractiveOverlay onNext={next} onPrevious={previous} onClose={onClose} onPause={pause} onResume={resume}
        onSwipeDown={(y, active) => setSwipe({ y, active })} hasLinkContent={!story.story_state && !!story.stickerData?.some(item => item.infoType === 'link')}
        onShowLinkOverlay={() => { setLinks(true); pause('link-overlay'); }} resharedPostId={story.resharedPostId}
        onNavigateToPost={id => { onClose(); navigate(`/post/${id}`); }}
        swipeTranslateY={swipe.active ? swipe.y : 0} swipeScale={swipe.active ? Math.max(.85, 1 - swipe.y / 1500) : 1}
        swipeOpacity={swipe.active ? Math.max(.3, 1 - swipe.y / 300) : 1} isSwipingDown={swipe.active} swipeDownY={swipe.y}>
        <StoryMediaRenderer key={mediaKey} story={story} videoRef={video} paused={paused} muted={muted}
          onReady={() => setMedia(current => current.key === mediaKey && current.status === 'error' ? current : { key: mediaKey, status: 'ready' })}
          onWaiting={() => setMedia(current => current.key === mediaKey && current.status === 'error' ? current : { key: mediaKey, status: 'loading' })}
          onError={() => setMedia({ key: mediaKey, status: 'error' })} onMentionClick={showProfile} />
        <StoryProgressBar config={group.map((_, i) => ({ isCurrent: i === groupIndex, isComplete: i < groupIndex }))} progress={progress} className="story-viewer-progress" />
        <StoryHeader key={storyId} story={story} isOwnStory={own} onClose={onClose} onShowProfile={() => showProfile(story.user.id || '')}
          onPause={pause} onResume={resume} onDelete={() => requestConfirm('delete')} onHide={() => requestConfirm('hide')}
          onReport={() => { setReport(true); pause('report'); }} paused={pauses.has('manual')} muted={muted}
          onTogglePause={() => pauses.has('manual') ? resume('manual') : pause('manual')} onToggleMute={() => setMuted(value => !value)} />
        {status === 'loading' && <div className="story-viewer-error"><SerkleLoader dark label="Loading story" showText /></div>}
        {status === 'error' && <div className="story-viewer-error" data-story-controls><RefreshCw size={28} /><p className="font-semibold">This moment couldn’t load</p><p className="text-sm text-white/60 max-w-64">Check your connection, then try again or skip to the next story.</p><button className="story-primary" onClick={() => setAttempt(value => value + 1)}>Try again</button><button className="story-secondary" onClick={next}>Next story</button></div>}
        {!story.story_state && <StoryStickers stickerData={story.stickerData} onMentionClick={showProfile} />}
        <StoryLinkOverlay showLinkOverlay={links} stickerData={story.stickerData} onClose={() => { setLinks(false); resume('link-overlay'); }} />
        <StoryBottomBar key={storyId} isOwnStory={own} storyDbId={dbId} isLiked={liked} isLikeLoading={liking} onLikeToggle={toggleLike}
          isResharing={resharing} isMentionedInStory={mentions.some(mention => mention.user_id === user?.id) && !own} onReshare={reshare}
          onSendMessage={async text => {
            if (!dbId || !user?.id || !story.user.id) throw new Error('Sign in to reply to this story.');
            await storyService.sendMessage(dbId, user.id, story.user.id, text);
            toast({ title: 'Reply queued', description: 'It will send when your connection is available.' });
          }}
          onShowActivity={() => { setActivity(true); pause('activity'); }}
          onShare={() => { void shareStory(story.user.username || story.user.id, story.user.name); }}
          onPause={pause} onResume={resume} storyMentions={mentions} onMentionClick={showProfile} />
      </StoryInteractiveOverlay>
    </div>
    <div className="story-desktop-nav">
      <button aria-label="Previous story" onClick={previous}><ChevronLeft size={20} /></button><button aria-label="Next story" onClick={next}><ChevronRight size={20} /></button>
    </div>
    {profileId !== null && <PublicProfileModal isOpen onClose={() => { setProfileId(null); resume('profile'); }} userId={profileId} />}
    {dbId && own && <StoryActivityModal isOpen={activity} onClose={() => { setActivity(false); resume('activity'); }} storyId={dbId} />}
    {report && <StoryReportDialog onClose={() => { setReport(false); resume('report'); }} onSubmit={async (reason, details) => {
      if (!dbId || !user?.id) return;
      const { error } = await storyService.reportStory(dbId, user.id, story.user.id || null, reason, details);
      if (error) throw error;
      toast({ title: 'Report submitted' });
    }} />}
    <AlertDialog open={!!confirm} onOpenChange={open => { if (!open && !removing) { setConfirm(null); resume('confirm'); } }}>
      <AlertDialogContent className="rounded-2xl bg-white text-[#111] w-[calc(100%_-_32px)]">
        <AlertDialogTitle>{confirm === 'delete' ? 'Delete this story?' : 'End this story early?'}</AlertDialogTitle>
        <AlertDialogDescription>{confirm === 'delete' ? 'This removes the story and its activity. This cannot be undone.' : 'Your story will disappear from the feed now, before its 24 hours are up.'}</AlertDialogDescription>
        <AlertDialogFooter><AlertDialogCancel disabled={removing}>Keep story</AlertDialogCancel><AlertDialogAction disabled={removing} onClick={event => { event.preventDefault(); void removeStory(); }}>{removing ? 'Updating…' : confirm === 'delete' ? 'Delete story' : 'End story'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </StoryDialog>;
}

export default function StoryViewer({ isOpen, ...props }: StoryViewerProps) {
  return isOpen ? <ActiveStoryViewer {...props} /> : null;
}
