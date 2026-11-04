import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Send, Check } from 'lucide-react';
import { Conversation } from '@/hooks/useConversations';

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onForward: (conversationIds: string[]) => void;
}

const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  isOpen, onClose, conversations, onForward,
}) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = conversations.filter(c =>
    c.other_user_name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleForward = () => {
    if (selected.length > 0) {
      onForward(selected);
      setSelected([]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Forward to</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {filtered.map((conv) => {
            const isSelected = selected.includes(conv.conversation_id);
            return (
              <button
                key={conv.conversation_id}
                onClick={() => toggle(conv.conversation_id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors ${
                  isSelected ? 'bg-primary/10' : 'hover:bg-muted/60'
                }`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={conv.other_user_avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xs">
                    {conv.other_user_initials}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-left text-sm font-medium truncate">{conv.other_user_name}</span>
                {isSelected && (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selected.length > 0 && (
          <Button onClick={handleForward} className="w-full rounded-xl gap-2">
            <Send className="h-4 w-4" />
            Forward to {selected.length} chat{selected.length > 1 ? 's' : ''}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ForwardMessageModal;
