import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface CommentActionMenuProps {
  isOpen: boolean;
  isOwn: boolean;
  position: { x: number; y: number };
  commentText: string;
  onClose: () => void;
  onEdit: (newText: string) => void;
  onDelete: () => void;
}

const CommentActionMenu: React.FC<CommentActionMenuProps> = ({
  isOpen, isOwn, position, commentText, onClose, onEdit, onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(commentText);

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

  useEffect(() => {
    if (isOpen) {
      setEditText(commentText);
      setIsEditing(false);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, commentText]);

  if (!isOpen || !isOwn) return null;

  // Position menu
  const menuWidth = 160;
  const menuHeight = 100;
  let left = position.x - menuWidth / 2;
  let top = position.y - menuHeight - 8;
  if (left < 8) left = 8;
  if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
  if (top < 8) top = position.y + 8;

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
        <div
          ref={menuRef}
          className="bg-popover border border-border rounded-2xl shadow-xl p-4 w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-sm font-semibold text-popover-foreground mb-2">Edit Comment</h3>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full bg-muted/50 text-sm text-popover-foreground rounded-xl px-3 py-2 outline-none resize-none min-h-[60px] border border-border"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="size-4 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              disabled={!editText.trim() || editText.trim() === commentText}
              onClick={() => { onEdit(editText.trim()); onClose(); }}
            >
              <Check className="size-4 mr-1" /> Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[2px] animate-fade-in" onClick={onClose}>
        <div
          ref={menuRef}
          className="absolute bg-popover border border-border rounded-2xl shadow-xl overflow-hidden animate-scale-in"
          style={{ left, top, width: menuWidth }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-popover-foreground hover:bg-muted/60 transition-colors active:scale-[0.98]"
          >
            <Pencil className="size-4" />
            <span className="font-medium">Edit</span>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors active:scale-[0.98]"
          >
            <Trash2 className="size-4" />
            <span className="font-medium">Delete</span>
          </button>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => { if (!open) { setShowDeleteConfirm(false); onClose(); } }}>
        <AlertDialogContent className="rounded-2xl max-w-xs mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => { onDelete(); onClose(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full"
            >
              Delete
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CommentActionMenu;
