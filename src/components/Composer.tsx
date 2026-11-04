import React, { useState } from 'react';
import { Plus, Camera, BarChart3, Users, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { usePostMutations } from '@/hooks/usePostMutations';
import MentionTextarea from '@/components/MentionTextarea';

interface ComposerProps {
  onPhoto: () => void;
  onPoll: () => void;
  onCircle: () => void;
  onAsk: () => void;
}

const ComposerChip = ({ icon, label, onClick }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-subtle hover:bg-muted/50 transition-all duration-200 hover:scale-105 border border-primary/20 group"
    aria-label={label}
  >
    <div className="transition-transform duration-200 group-hover:scale-110">
      {icon}
    </div>
    <span className="text-xs font-semibold text-foreground">{label}</span>
  </button>
);

const Composer: React.FC<ComposerProps> = ({ onPhoto, onPoll, onCircle, onAsk }) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { createPost, isCreating } = usePostMutations();
  const [expanded, setExpanded] = useState(false);
  const [postContent, setPostContent] = useState('');

  return (
    <article className="bg-card rounded-2xl border border-border transition-all duration-300 overflow-hidden">
      {!expanded ? (
        <button
          type="button"
          aria-label="Compose a post"
          className="w-full p-4 text-left flex items-center gap-3 hover:bg-gradient-subtle transition-all duration-200 hover:scale-[1.02] group"
          onClick={() => setExpanded(true)}
        >
          <div className="size-8 rounded-full bg-gradient-primary flex items-center justify-center">
            <span className="text-xs font-bold text-white">You</span>
          </div>
          <span className="text-muted-foreground flex-1 text-sm font-medium group-hover:text-foreground transition-colors">
            What's on your mind?
          </span>
          <Camera className="size-5 text-primary transition-transform duration-200 group-hover:scale-110" />
        </button>
      ) : (
        <div className="p-4 animate-fade-in">
          <div className="flex items-start gap-3 mb-4">
            <div className="size-8 rounded-full bg-gradient-primary flex items-center justify-center">
              <span className="text-xs font-bold text-white">You</span>
            </div>
            <div className="flex-1">
              <MentionTextarea
                className="w-full resize-none border-none outline-none text-foreground placeholder-muted-foreground text-sm leading-relaxed bg-transparent"
                placeholder="What's on your mind?"
                rows={2}
                autoFocus
                value={postContent}
                onChange={setPostContent}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <ComposerChip icon={<Camera className="size-4 text-primary" />} label="Photo" onClick={onPhoto} />
            <ComposerChip icon={<BarChart3 className="size-4 text-primary" />} label="Poll" onClick={onPoll} />
            <ComposerChip icon={<Users className="size-4 text-primary" />} label="Circle" onClick={onCircle} />
            <ComposerChip icon={<HelpCircle className="size-4 text-primary" />} label="Ask" onClick={onAsk} />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-border/40">
            <button
              type="button"
              className="text-muted-foreground text-sm font-medium hover:text-foreground transition-colors px-3 py-2 rounded-xl hover:bg-muted/30"
              onClick={() => {
                setExpanded(false);
                setPostContent('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-6 py-2 bg-gradient-primary text-white rounded-xl transition-all duration-200 font-semibold hover:scale-105 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!postContent.trim() || isCreating}
              onClick={async () => {
                if (!user) {
                  navigate('/login');
                  return;
                }
                try {
                  await createPost({ content: postContent }, user.id);
                  setPostContent('');
                  setExpanded(false);
                  window.location.reload();
                } catch (error) {
                  console.error('Failed to create post:', error);
                }
              }}
            >
              {isCreating ? 'Posting...' : 'Share'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

export default Composer;