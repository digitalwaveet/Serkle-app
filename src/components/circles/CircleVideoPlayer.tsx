import React, { useRef, useState, useEffect, useMemo } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, ChevronLeft, 
  Lock, Crown, Coins, Eye, Share2, MessageCircle, Heart, 
  Bookmark, Scissors, MoreHorizontal, CheckCircle2, Gift,
  SkipBack, SkipForward, Settings, Fullscreen, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CircleVideo } from '@/hooks/useCircleVideos';
import { Circle } from '@/hooks/useCircles';
import { useCircleVideoInteractions } from '@/hooks/useCircleVideoInteractions';
import { useCircleVideoDuration } from '@/hooks/useCircleVideoDuration';
import { cn } from '@/lib/utils';
import { formatCircleCount } from '@/lib/circleCountFormat';
import { formatDistanceToNow } from 'date-fns';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import './CircleVideoPlayer.css';

interface CircleVideoPlayerProps {
  video: CircleVideo;
  circle: Circle;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onUnlock?: (video: CircleVideo) => void;
  isUnlocking?: boolean;
}

const CircleVideoPlayer: React.FC<CircleVideoPlayerProps> = ({ 
  video, 
  circle,
  onClose, 
  onNext, 
  onPrevious,
  onUnlock,
  isUnlocking = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeTimeRef = useRef(0);
  const sourceRef = useRef(video.video_url);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const { seconds: duration, label: durationLabel, recordDuration } = useCircleVideoDuration(video);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGiftingOpen, setIsGiftingOpen] = useState(false);
  const [selectedGift, setSelectedGift] = useState<string>('Flower');
  const [giftStatus, setGiftStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  
  // Real-time Interactions Hook
  const { 
    likesCount, 
    userHasLiked, 
    comments, 
    sharesCount, 
    toggleLike, 
    addComment, 
    incrementShare 
  } = useCircleVideoInteractions(video.id);

  const [newComment, setNewComment] = useState('');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  const isLocked = video.is_premium && !video.user_has_unlocked;
  const prevWasLocked = useRef(isLocked);

  useEffect(() => {
    if (prevWasLocked.current && !isLocked && videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
    prevWasLocked.current = isLocked;
  }, [isLocked]);

  const togglePlay = () => {
    if (isLocked) return;
    if (videoRef.current?.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current?.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      if (videoRef.current.readyState === 0) return;
      resumeTimeRef.current = videoRef.current.currentTime;
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      recordDuration(videoRef.current.duration);
      if (sourceRef.current !== video.video_url) {
        sourceRef.current = video.video_url;
        videoRef.current.currentTime = resumeTimeRef.current;
        if (isPlaying) void videoRef.current.play().catch(() => setIsPlaying(false));
      }
    }
  };

  const handleSliderChange = (value: number[]) => {
    if (videoRef.current && duration !== null) {
      const time = Math.min(duration, Math.max(0, value[0]));
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleSendGift = () => {
    setGiftStatus('sending');
    setTimeout(() => {
      setGiftStatus('sent');
      setTimeout(() => {
        setIsGiftingOpen(false);
        setGiftStatus('idle');
      }, 1400);
    }, 800);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await addComment(newComment);
    setNewComment('');
  };

  const gifts = [
    { name: 'Flower', icon: '🌸', price: 5 },
    { name: 'Rose', icon: '🌹', price: 50 },
    { name: 'Diamond', icon: '💎', price: 500 },
    { name: 'Rocket', icon: '🚀', price: 200 },
    { name: 'Crown', icon: '👑', price: 1000 },
    { name: 'Bolt', icon: '⚡', price: 100 },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col premium-player-container overflow-hidden h-screen w-screen">

      {/* Header Controls (Above Video) */}
      <div className="w-full p-4 flex items-center justify-between bg-background border-b border-muted/20 z-20">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-primary hover:bg-transparent">
          <ChevronLeft className="size-8" />
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="px-2 py-1 bg-primary rounded-md flex items-center gap-1.5">
             <div className="size-1.5 rounded-full bg-white animate-blink" />
             <span className="text-[10px] font-bold text-white uppercase tracking-tighter">LIVE</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-primary hover:bg-transparent">
            <X className="size-8" />
          </Button>
        </div>
      </div>

      {/* Video Player Section */}
      <div className="relative w-full aspect-video bg-black overflow-hidden shadow-2xl">
        {isLocked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-10 p-6 text-center">
             <div className="size-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                <Crown className="size-8 text-secondary" />
             </div>
             <h3 className="text-xl font-bold mb-2 text-white">Premium Experience</h3>
             <p className="text-white/40 text-sm mb-8 max-w-[280px]">Unlock this exclusive content and support the creator.</p>
             <Button 
                onClick={() => onUnlock?.(video)}
                disabled={isUnlocking}
                className="w-full max-w-[280px] h-14 rounded-2xl bg-secondary hover:bg-secondary/90 text-white font-bold text-lg gap-3 shadow-xl shadow-secondary/20 border-none"
             >
                <Coins className="size-5" />
                {isUnlocking ? 'Processing�' : `Unlock for ${video.price} Coins`}
             </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={video.video_url}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onDurationChange={handleLoadedMetadata}
              onLoadedData={handleLoadedMetadata}
              onWaiting={() => setIsLoading(true)}
              onCanPlay={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
              onClick={togglePlay}
              playsInline
            />

            {/* Center Controls */}
            <div className={cn(
              "absolute inset-0 flex items-center justify-center gap-10 transition-opacity duration-300 z-10",
              !isPlaying ? "opacity-100" : "opacity-0 invisible"
            )}>
               <Button variant="ghost" size="icon" onClick={onPrevious} className="text-primary rounded-full scale-125 hover:bg-white/10">
                 <SkipBack className="size-7 fill-current" />
               </Button>
               <button 
                 onClick={togglePlay}
                 className="size-16 rounded-full bg-secondary text-white flex items-center justify-center shadow-2xl transition-transform active:scale-90 glass-overlay"
               >
                 {isPlaying ? <Pause className="size-8 fill-current" /> : <Play className="size-8 fill-current ml-1" />}
               </button>
               <Button variant="ghost" size="icon" onClick={onNext} className="text-primary rounded-full scale-125 hover:bg-white/10">
                 <SkipForward className="size-7 fill-current" />
               </Button>
            </div>

            {/* Bottom Controls */}
            <div className={cn(
              "absolute bottom-4 left-4 right-4 transition-opacity duration-300 z-10 flex flex-col",
              !isPlaying ? "opacity-100" : "opacity-0 invisible"
            )}>
              {/* Floating Timeline Section */}
              <div className="px-2">
                <div className="flex items-center justify-between mb-1.5 text-[10px] font-bold text-white/90 drop-shadow-md">
                  <span>{formatTime(currentTime)}</span>
                  {durationLabel && <span data-testid="circle-video-total-duration">{durationLabel}</span>}
                </div>
                
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  disabled={duration === null}
                  step={0.1}
                  onValueChange={handleSliderChange}
                  className="cursor-pointer thin-slider"
                />
              </div>

              {/* Controls Section (Glassmorphism) */}
              <div className="p-4 rounded-2xl glass-overlay">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                        {isMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                     </button>
                  </div>
                  <div className="flex items-center gap-4">
                     <Settings className="size-5 text-white/70 hover:text-white transition-colors" />
                     <Fullscreen className="size-5 text-white/70 hover:text-white transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Content Body */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scrollbar-none pb-safe"
      >
        {/* Video Info Block */}
        <section className="px-[18px] pt-6 space-y-4">
          <h1 className="text-[18px] font-bold leading-tight text-foreground">
            {video.title}
          </h1>
          
          <div className="flex flex-wrap gap-2 text-muted-foreground text-[12px]">
             <span>{video.views_count} views</span>
             <span>•</span>
             <span>{formatDistanceToNow(new Date(video.created_at || Date.now()))} ago</span>
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 -mx-[18px] px-[18px]">
             <button 
               onClick={toggleLike}
               className={cn(
                 "flex flex-col items-center justify-center gap-1.5 min-w-[64px] h-[72px] rounded-[20px] transition-all active:scale-95",
                 userHasLiked ? "bg-primary/10 text-primary" : "bg-muted/20 text-muted-foreground"
               )}
             >
               <Heart className={cn("size-5", userHasLiked && "fill-current")} />
               <span className="text-[10px] font-extrabold">{likesCount > 1000 ? (likesCount/1000).toFixed(1) + 'K' : likesCount}</span>
             </button>
             
             <button className="flex flex-col items-center justify-center gap-1.5 min-w-[64px] h-[72px] rounded-[20px] bg-muted/20 text-muted-foreground">
               <MessageCircle className="size-5" />
               <span className="text-[10px] font-extrabold">{comments.length}</span>
             </button>

             <button 
               onClick={incrementShare}
               className="flex flex-col items-center justify-center gap-1.5 min-w-[64px] h-[72px] rounded-[20px] bg-muted/20 text-muted-foreground"
             >
               <Share2 className="size-5" />
               <span className="text-[10px] font-extrabold">{sharesCount}</span>
             </button>

             <button className="flex flex-col items-center justify-center gap-1.5 min-w-[64px] h-[72px] rounded-[20px] bg-muted/20 text-muted-foreground">
               <Bookmark className="size-5" />
               <span className="text-[10px] font-extrabold tracking-tighter">Save</span>
             </button>
          </div>
        </section>

        {/* Circle Row */}
        <section className="mt-6 px-[18px] py-4 border-y border-muted/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <Avatar className="size-12 border-2 border-primary/20">
               <AvatarImage src={circle.avatar_url || ''} alt={circle.name} />
               <AvatarFallback className="bg-primary/10 text-primary text-lg font-black">{circle.name.substring(0, 2).toUpperCase()}</AvatarFallback>
             </Avatar>
             <div>
                <div className="flex items-center gap-1.5">
                   <span className="font-bold text-[15px]">{circle.name}</span>
                   <CheckCircle2 className="size-4 text-primary" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{formatCircleCount(circle.members_count || 0, 'member')}</span>
             </div>
          </div>
          
          <button 
            onClick={() => setIsGiftingOpen(true)}
            className="flex h-10 px-4 items-center gap-2 rounded-full bg-secondary text-white font-black text-[12px] shadow-lg shadow-secondary/20 active:scale-95 transition-all"
          >
             <Gift className="size-4" />
             GIFT
          </button>
        </section>

        {/* Collapsible Description */}
        <section className="px-[18px] py-6">
          <div 
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            className="cursor-pointer group"
          >
             <p className={cn(
               "text-[14px] leading-relaxed text-foreground/80 font-medium whitespace-pre-line",
               !isDescriptionExpanded && "line-clamp-2"
             )}>
               {video.description || "No description provided."}
             </p>
             {!isDescriptionExpanded && video.description && video.description.length > 60 && (
               <span className="text-[11px] font-bold text-primary mt-1 block">Read more</span>
             )}
          </div>
        </section>

        {/* Comments Section */}
        <section className="px-[18px] pb-20 space-y-6 border-t border-muted/30 pt-6">
           <div className="flex items-center justify-between">
              <span className="font-black text-[16px] text-foreground">{formatCircleCount(comments.length, 'comment')}</span>
           </div>

           {/* Comment Input */}
           <form onSubmit={handleCommentSubmit} className="flex gap-3 items-center">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">ME</div>
              <input 
                type="text" 
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 bg-muted/20 rounded-full h-10 px-4 text-sm outline-none focus:ring-1 focus:ring-primary/30"
              />
              <Button type="submit" variant="ghost" size="sm" className="text-primary font-bold">Post</Button>
           </form>

           <div className="space-y-6">
              {(showAllComments ? comments : comments.slice(0, 3)).map((c) => (
                <div key={c.id} className="flex gap-4 animate-in fade-in duration-300">
                   <Avatar className="size-9">
                     <AvatarImage src={c.profiles.avatar_url || ''} />
                     <AvatarFallback className={cn("text-[10px] font-bold", c.profiles.avatar_color || 'bg-muted')}>
                       {c.profiles.initials || '??'}
                     </AvatarFallback>
                   </Avatar>
                   <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <span className="font-bold text-[13px]">{c.profiles.name}</span>
                            <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at))} ago</span>
                         </div>
                      </div>
                      <p className="text-[14px] text-foreground/80 leading-relaxed">{c.content}</p>
                   </div>
                </div>
              ))}

              {!showAllComments && comments.length > 3 && (
                <Button 
                  variant="ghost" 
                   onClick={() => setShowAllComments(true)}
                  className="w-full text-primary font-bold text-sm"
                >
                  View all {formatCircleCount(comments.length, 'comment')}
                </Button>
              )}
           </div>
        </section>
      </div>

      {/* Gift Bottom Sheet */}
      <Drawer open={isGiftingOpen} onOpenChange={setIsGiftingOpen}>
        <DrawerContent className="bg-background border-muted text-foreground rounded-t-[32px]">
          <div className="mx-auto mt-4 h-1 w-10 rounded-full bg-muted" />
          <DrawerHeader className="text-center pt-6 pb-2">
            <DrawerTitle className="text-2xl font-black text-primary">Support Creator</DrawerTitle>
            <DrawerDescription className="font-bold uppercase tracking-widest text-[10px]">Send a gift to {circle.name}</DrawerDescription>
          </DrawerHeader>

          <div className="px-6 py-4 grid grid-cols-3 gap-3">
            {gifts.map((g) => (
              <button 
                key={g.name}
                onClick={() => setSelectedGift(g.name)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                  selectedGift === g.name 
                    ? "bg-secondary/10 border-secondary shadow-md" 
                    : "bg-muted/10 border-transparent"
                )}
              >
                <span className="text-2xl">{g.icon}</span>
                <div className="text-center">
                   <p className="text-[10px] font-bold text-muted-foreground">{g.name}</p>
                   <p className="text-[12px] font-black">{g.price}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="p-6">
             <Button 
               onClick={handleSendGift}
               disabled={giftStatus !== 'idle'}
               className={cn(
                 "w-full h-12 rounded-xl font-bold transition-all",
                 giftStatus === 'sent' ? "bg-emerald-500 hover:bg-emerald-500" : "bg-secondary"
               )}
             >
               {giftStatus === 'idle' && "Send Gift"}
               {giftStatus === 'sending' && "Sending..."}
               {giftStatus === 'sent' && "Sent!"}
             </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default CircleVideoPlayer;
