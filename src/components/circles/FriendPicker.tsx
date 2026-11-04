import React, { useState } from 'react';
import { X, Check, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFriendsList } from '@/hooks/useCircleInvitations';
import { useUser } from '@/contexts/UserContext';

interface Friend {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  initials: string;
  avatar_color: string;
}

interface FriendPickerProps {
  multiSelect: boolean;
  selected: Friend[];
  onSelect: (friends: Friend[]) => void;
}

const FriendPicker: React.FC<FriendPickerProps> = ({ multiSelect, selected, onSelect }) => {
  const { user } = useUser();
  const [search, setSearch] = useState('');
  const { data: friends = [], isLoading } = useFriendsList(user?.id, search);

  const isSelected = (id: string) => selected.some(f => f.id === id);

  const toggle = (friend: Friend) => {
    if (isSelected(friend.id)) {
      onSelect(selected.filter(f => f.id !== friend.id));
    } else {
      if (multiSelect) {
        onSelect([...selected, friend]);
      } else {
        onSelect([friend]);
      }
    }
  };

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(f => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              @{f.username}
              <button onClick={() => toggle(f)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search friends by @username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {/* Friends list */}
      <div className="max-h-[200px] overflow-y-auto space-y-0.5">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Loading friends...</p>
        ) : friends.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {search ? 'No friends found' : 'You haven\'t followed anyone yet'}
          </p>
        ) : (
          friends.map((friend: Friend) => {
            const sel = isSelected(friend.id);
            return (
              <button
                key={friend.id}
                onClick={() => toggle(friend)}
                className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-colors text-left ${
                  sel ? 'bg-primary/10' : 'hover:bg-muted'
                }`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={friend.avatar_url || undefined} />
                  <AvatarFallback
                    className="text-xs"
                    style={{ backgroundColor: friend.avatar_color }}
                  >
                    {friend.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{friend.name}</p>
                  <p className="text-xs text-muted-foreground truncate">@{friend.username}</p>
                </div>
                {sel && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FriendPicker;
