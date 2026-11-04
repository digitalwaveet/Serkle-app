import React, { useEffect, useRef, useState } from 'react';
import { Play, Clock, BarChart2, Lock, MoreVertical, Edit2, Trash2, Eye, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CircleVideo } from '@/hooks/useCircleVideos';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useCircleVideoDuration } from '@/hooks/useCircleVideoDuration';

interface CircleVideoCardProps {
  video: any;
  onClick: (video: any) => void;
  isUnlocked?: boolean;
  isOwner?: boolean;
  onEdit?: (video: any) => void;
  onDelete?: (video: any) => void;
}

export const CircleVideoCard: React.FC<CircleVideoCardProps> = ({ 
  video, 
  onClick, 
  isUnlocked = false,
  isOwner = false,
  onEdit,
  onDelete
}) => {
  const isLocked = video.is_premium && !video.user_has_unlocked;
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!cardRef.current) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);
  // Recover missing legacy metadata only for visible, accessible videos.
  const { label: durationLabel } = useCircleVideoDuration(video, visible && !isLocked);

  return (
    <Card 
      ref={cardRef}
      className="overflow-hidden cursor-pointer group hover:shadow-lg transition-all border-none bg-card/50 backdrop-blur-sm"
      onClick={() => onClick(video)}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {video.thumbnail_url ? (
          <img 
            src={video.thumbnail_url} 
            alt={video.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <Play className="size-12 text-primary/20" />
          </div>
        )}
        
        {/* Overlay Badges */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
        
        {isOwner && (
          <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={() => onEdit?.(video)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete?.(video)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {durationLabel && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-medium rounded" data-testid="circle-video-duration">
            {durationLabel}
          </div>
        )}

        {video.is_premium && (
          <div className="absolute top-2 right-2">
            <Badge variant={video.user_has_unlocked ? "secondary" : "default"} className="gap-1 shadow-md bg-secondary text-secondary-foreground border-none">
              {video.user_has_unlocked ? (
                <Lock className="size-3 opacity-50" />
              ) : (
                <Crown className="size-3 text-yellow-400" />
              )}
              {video.user_has_unlocked ? 'Unlocked' : `${video.price} Coins`}
            </Badge>
          </div>
        )}

        {/* Play Icon on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="size-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform">
            {isLocked ? <Lock className="size-6" /> : <Play className="size-6 fill-current" />}
          </div>
        </div>
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2 leading-tight mb-1 group-hover:text-primary transition-colors">
          {video.title}
        </h3>
        
        <div className="flex items-center gap-2 mb-2">
          <div className="size-5 rounded-full overflow-hidden border border-border">
            {video.author.avatar_url ? (
              <img src={video.author.avatar_url} alt={video.author.name} className="w-full h-full object-cover" />
            ) : (
              <div 
                className="w-full h-full flex items-center justify-center text-[8px] text-white font-bold"
                style={{ backgroundColor: video.author.avatar_color }}
              >
                {video.author.initials}
              </div>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground font-medium truncate">
            {video.author.name}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="size-3" />
            {video.views_count.toLocaleString()} views
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default CircleVideoCard;
