import React from 'react';
import { MoreHorizontal, X, Trash2, EyeOff, Flag, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Story, PauseReason } from '@/types/storyTypes';
import { storyRelativeTime } from '@/lib/storyMedia';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface StoryHeaderProps {
  story: Story; isOwnStory: boolean; onClose: () => void; onShowProfile: () => void;
  onPause: (reason: PauseReason) => void; onResume: (reason: PauseReason) => void;
  onDelete: () => void; onHide: () => void; onReport: () => void;
  paused: boolean; muted: boolean; onTogglePause: () => void; onToggleMute: () => void;
}
export function StoryHeader({ story, isOwnStory, onClose, onShowProfile, onPause, onResume, onDelete, onHide, onReport, paused, muted, onTogglePause, onToggleMute }: StoryHeaderProps) {
  return <div className="story-viewer-header absolute left-3 right-3 z-30 flex items-center gap-1" data-story-controls>
    <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={onShowProfile} aria-label={`View ${story.user.name}'s profile`}>
      <span className="size-8 rounded-full overflow-hidden bg-neutral-700 text-white text-xs font-semibold flex items-center justify-center shrink-0 ring-1 ring-white/20">
        {story.user.avatar ? <img src={story.user.avatar} alt="" className="size-full object-cover" /> : story.user.initials}
      </span>
      <span className="min-w-0"><span className="block truncate text-white font-semibold text-[13px]">{isOwnStory ? 'Your story' : story.user.name}</span><span className="block text-white/70 text-[10px] mt-0.5">{storyRelativeTime(story.createdAt)}</span></span>
    </button>
    <button className="story-icon-btn" onClick={onTogglePause} aria-label={paused ? 'Play story' : 'Pause story'}>{paused ? <Play size={17} /> : <Pause size={17} />}</button>
    {story.mediaType === 'video' && <button className="story-icon-btn" onClick={onToggleMute} aria-label={muted ? 'Unmute story' : 'Mute story'}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>}
    <DropdownMenu onOpenChange={open => open ? onPause('menu') : onResume('menu')}>
      <DropdownMenuTrigger asChild><button className="story-icon-btn" aria-label="Story options"><MoreHorizontal size={20} /></button></DropdownMenuTrigger>
      <DropdownMenuContent className="z-[210] rounded-xl p-2 bg-white text-[#111]" align="end">
        {isOwnStory ? <>
          <DropdownMenuItem onSelect={onDelete} className="gap-2 py-3 text-destructive"><Trash2 size={16} />Delete story</DropdownMenuItem>
        </> : <DropdownMenuItem onSelect={onReport} className="gap-2 py-3"><Flag size={16} />Report story</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    <button className="story-icon-btn" onClick={onClose} aria-label="Close story"><X size={20} /></button>
  </div>;
}
