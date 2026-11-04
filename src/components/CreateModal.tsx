import React from 'react';
import { Plus, MessageSquare, Users, ShoppingBag, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateAction = ({ icon, label, description, onClick }: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group w-full rounded-xl border border-border p-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors"
    aria-label={`Create ${label}`}
  >
    <div className="text-sm font-medium text-primary">
      {label}
    </div>
    {description && (
      <div className="text-xs mt-0.5 text-muted-foreground">
        {description}
      </div>
    )}
    <div className="mt-2 h-6 w-6 rounded-md grid place-items-center group-hover:opacity-90 bg-tertiary" aria-hidden>
      {icon}
    </div>
  </button>
);

const CreateModal: React.FC<CreateModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleAction = (action: string) => {
    if (action === 'post') {
      navigate('/create/post');
    } else if (action === 'video') {
      navigate('/create/video');
    } else if (action === 'circle') {
      navigate('/create/circle');
    } else if (action === 'shop') {
      navigate('/create/shop');
    }
    onClose();
  };

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label="Create"
      className="fixed inset-0 z-50 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Close create menu"
        className="absolute inset-0 w-full h-full backdrop-blur-xl bg-black/30"
        onClick={onClose}
      />

      <div className="absolute bottom-0 inset-x-0 mx-auto max-w-[480px] rounded-t-2xl bg-card shadow-2xl border border-border animate-slide-up">
        <div className="px-5 pt-4 pb-2">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-muted-foreground/30 mb-3" aria-hidden />
          <h3 className="text-base font-semibold text-primary">
            Create
          </h3>
          <p className="text-sm text-muted-foreground">
            Post an update, start a circle, or explore the shop.
          </p>
        </div>

        <div className="px-3 pb-5 grid grid-cols-2 gap-3">
          <CreateAction
            icon={<MessageSquare className="size-4 text-primary" />}
            label="Post"
            description="Text or photo"
            onClick={() => handleAction("post")}
          />
          <CreateAction
            icon={<Video className="size-4 text-primary" />}
            label="Video"
            description="For Relax feed"
            onClick={() => handleAction("video")}
          />
          <CreateAction
            icon={<Users className="size-4 text-primary" />}
            label="Circle"
            description="Start a group"
            onClick={() => handleAction("circle")}
          />
          <CreateAction
            icon={<ShoppingBag className="size-4 text-primary" />}
            label="Shop"
            description="List an item"
            onClick={() => handleAction("shop")}
          />
        </div>

        <div className="px-3 pb-4">
          <button
            type="button"
            className="w-full rounded-xl border border-border py-2 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateModal;