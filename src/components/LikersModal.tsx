import React, { useState, useEffect } from 'react';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicProfileModal from './PublicProfileModal';

interface Liker {
  id: string;
  name: string;
  username: string;
  initials: string;
  avatar_url: string | null;
  avatar_color: string;
  reaction_type: string;
}

const REACTION_EMOJIS: Record<string, string> = {
  like: '❤️',
  love: '👍',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😡'
};

interface LikersModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

const LikersModal: React.FC<LikersModalProps> = ({ isOpen, onClose, postId }) => {
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const fetchLikers = async () => {
      const { data, error } = await supabase
        .from('likes')
        .select('user_id, reaction_type, profiles:user_id(id, name, username, initials, avatar_url, avatar_color)')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const mapped = data
          .filter((l: any) => l.profiles)
          .map((l: any) => ({
            id: l.profiles.id,
            name: l.profiles.name,
            username: l.profiles.username,
            initials: l.profiles.initials,
            avatar_url: l.profiles.avatar_url,
            avatar_color: l.profiles.avatar_color,
            reaction_type: l.reaction_type || 'like',
          }));
        setLikers(mapped);
      }
      setLoading(false);
    };

    fetchLikers();
  }, [isOpen, postId]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
        <div
          className="bg-background w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[70vh] flex flex-col animate-in slide-in-from-bottom"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Reactions</h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
              <X className="size-5 text-muted-foreground" />
            </button>
          </div>

          {likers.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border overflow-x-auto no-scrollbar">
              {Object.entries(
                likers.reduce((acc, curr) => {
                  acc[curr.reaction_type] = (acc[curr.reaction_type] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([type, count]) => (
                <div key={type} className="flex items-center gap-1.5 px-2 py-1 bg-background rounded-full border border-border text-xs font-medium whitespace-nowrap shadow-sm">
                  <span>{REACTION_EMOJIS[type] || '❤️'}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-y-auto flex-1 p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8"><SerkleLoader size="sm" label="Loading likes" /></div>
            ) : likers.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">No likes yet</div>
            ) : (
              likers.map((liker) => (
                <button
                  key={liker.id}
                  onClick={() => setSelectedUserId(liker.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div
                    className="size-10 rounded-full flex items-center justify-center text-xs font-medium text-white overflow-hidden flex-shrink-0"
                    style={{ background: liker.avatar_color }}
                  >
                    {liker.avatar_url ? (
                      <img src={liker.avatar_url} alt={liker.name} className="w-full h-full object-cover" />
                    ) : (
                      liker.initials
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{liker.name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{liker.username}</p>
                  </div>
                  <div className="flex-shrink-0 text-lg">
                    {REACTION_EMOJIS[liker.reaction_type] || '❤️'}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedUserId && (
        <PublicProfileModal
          isOpen={!!selectedUserId}
          onClose={() => setSelectedUserId(null)}
          userId={selectedUserId}
        />
      )}
    </>
  );
};

export default LikersModal;
