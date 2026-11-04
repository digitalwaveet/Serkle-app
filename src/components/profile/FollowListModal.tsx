import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface FollowListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  type: 'followers' | 'following';
  onProfileClick?: () => void;
}

interface FollowUser {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  initials: string | null;
  avatar_color: string | null;
  is_verified: boolean | null;
}

const FollowListModal: React.FC<FollowListModalProps> = ({
  open,
  onOpenChange,
  userId,
  type,
  onProfileClick,
}) => {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || !userId) return;

    const fetchList = async () => {
      setIsLoading(true);
      try {
        // follows table: follower_id -> following_id
        const column = type === 'followers' ? 'following_id' : 'follower_id';
        const selectColumn = type === 'followers' ? 'follower_id' : 'following_id';

        const { data, error } = await supabase
          .from('follows')
          .select(`${selectColumn}, profiles:${selectColumn}(id, name, username, avatar_url, initials, avatar_color, is_verified)`)
          .eq(column, userId);

        if (error) throw error;

        const mapped = (data || [])
          .map((row: any) => row.profiles)
          .filter(Boolean) as FollowUser[];
        setUsers(mapped);
      } catch (err) {
        console.error(`Error fetching ${type}:`, err);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchList();
  }, [open, userId, type]);

  const handleUserClick = (targetUserId: string) => {
    onOpenChange(false);
    onProfileClick?.();
    navigate(`/profile/${targetUserId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="capitalize">{type}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {isLoading ? (
            <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading content" showText /></div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </p>
          ) : (
            <div className="space-y-1 py-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleUserClick(u.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback
                      className="text-xs font-semibold text-white"
                      style={{ backgroundColor: u.avatar_color || '#6366f1' }}
                    >
                      {u.initials || u.name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FollowListModal;
