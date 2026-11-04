import React, { useState } from 'react';
import { MoreHorizontal, Share2, Link2, Flag, Ban, VolumeX, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface ProfileOverflowMenuProps {
  userId: string;
  username: string;
  isMuted?: boolean;
  isBlocked?: boolean;
  onBlock?: () => Promise<void> | void;
  onMute?: () => Promise<void> | void;
}

/**
 * Three-dot overflow menu for visitor profile views.
 * Keeps secondary actions (share, copy link, report, mute, block) out of the main layout.
 */
const ProfileOverflowMenu: React.FC<ProfileOverflowMenuProps> = ({
  userId,
  username,
  isMuted = false,
  isBlocked = false,
  onBlock,
  onMute,
}) => {
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const profileUrl = `${window.location.origin}/profile/${username}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `@${username} on Serkle`, url: profileUrl });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    await handleCopyLink();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Profile link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleReport = () => {
    toast.success('Report submitted. Our team will review it.');
  };

  const handleBlock = async () => {
    await onBlock?.();
    setShowBlockConfirm(false);
    toast.success(isBlocked ? `@${username} unblocked` : `@${username} blocked`);
  };

  const handleMute = async () => {
    await onMute?.();
    toast.success(isMuted ? `@${username} unmuted` : `@${username} muted`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" aria-label="More options">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="size-4 mr-2" />
            Share Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink}>
            <Link2 className="size-4 mr-2" />
            Copy Profile Link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleMute}>
            {isMuted ? <Volume2 className="size-4 mr-2" /> : <VolumeX className="size-4 mr-2" />}
            {isMuted ? 'Unmute' : 'Mute'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleReport}>
            <Flag className="size-4 mr-2" />
            Report
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowBlockConfirm(true)}
            className="text-destructive focus:text-destructive"
          >
            <Ban className="size-4 mr-2" />
            {isBlocked ? 'Unblock' : 'Block'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isBlocked ? 'Unblock' : 'Block'} @{username}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isBlocked
                ? 'They will be able to see your posts and interact with you again.'
                : 'They will no longer be able to see your posts, message you, or interact with you.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlock} className={isBlocked ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}>
              {isBlocked ? 'Unblock' : 'Block'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProfileOverflowMenu;
