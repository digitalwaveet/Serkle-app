import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FriendPicker from '@/components/circles/FriendPicker';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Friend {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  initials: string;
  avatar_color: string;
}

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  onGroupCreated: (conversationId: string) => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  open,
  onClose,
  currentUserId,
  onGroupCreated,
}) => {
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    if (selectedFriends.length === 0) {
      toast.error('Please add at least one friend');
      return;
    }

    setIsCreating(true);
    try {
      const memberIds = selectedFriends.map(f => f.id);
      const { data, error } = await supabase.rpc('create_group_conversation', {
        _creator_id: currentUserId,
        _group_name: groupName.trim(),
        _member_ids: memberIds,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Group created!');
      onGroupCreated(data as string);
      handleClose();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSelectedFriends([]);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="w-full max-w-md bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button onClick={handleClose} className="p-1 hover:bg-muted rounded-full">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold">New Group</h2>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={isCreating || !groupName.trim() || selectedFriends.length === 0}
            className="rounded-full px-4 h-8 text-xs"
          >
            {isCreating ? <SerkleLoader size="xs" className="text-current" /> : 'Create'}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Group icon + name */}
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label htmlFor="group-name" className="text-xs text-muted-foreground">
                Group Name
              </Label>
              <Input
                id="group-name"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
          </div>

          {/* Friends picker */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Add Friends ({selectedFriends.length} selected)
            </Label>
            <FriendPicker
              multiSelect
              selected={selectedFriends}
              onSelect={setSelectedFriends}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
