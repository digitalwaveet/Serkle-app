import React, { useEffect, useRef } from 'react';
import { Reply, Forward, Copy, Pencil, Trash2, Pin, SmilePlus } from 'lucide-react';

interface MessageActionMenuProps {
  isOpen: boolean;
  isOwn: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  onReact: () => void;
}

const MessageActionMenu: React.FC<MessageActionMenuProps> = ({
  isOpen, isOwn, position, onClose,
  onReply, onForward, onCopy, onEdit, onDelete, onPin, onReact,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate position to keep menu on screen
  const menuWidth = 200;
  const menuHeight = 320;
  let left = position.x - menuWidth / 2;
  let top = position.y - menuHeight - 8;

  if (left < 8) left = 8;
  if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
  if (top < 8) top = position.y + 8;

  const actions = [
    { icon: SmilePlus, label: 'React', action: onReact, show: true },
    { icon: Reply, label: 'Reply', action: onReply, show: true },
    { icon: Forward, label: 'Forward', action: onForward, show: true },
    { icon: Copy, label: 'Copy', action: onCopy, show: true },
    { icon: Pencil, label: 'Edit', action: onEdit, show: isOwn },
    { icon: Pin, label: 'Pin', action: onPin, show: true },
    { icon: Trash2, label: 'Delete', action: onDelete, show: true, destructive: true },
  ];

  return (
    <div className="fixed inset-0 z-[80] bg-black/20 backdrop-blur-[2px] animate-fade-in" onClick={onClose}>
      <div
        ref={menuRef}
        className="absolute bg-popover border border-border rounded-2xl shadow-xl overflow-hidden animate-scale-in"
        style={{ left, top, width: menuWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {actions.filter(a => a.show).map((item) => (
          <button
            key={item.label}
            onClick={() => { item.action(); }}
            className={`flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors active:scale-[0.98] ${
              item.destructive
                ? 'text-destructive hover:bg-destructive/10'
                : 'text-popover-foreground hover:bg-muted/60'
            }`}
          >
            <item.icon className="h-4.5 w-4.5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MessageActionMenu;
