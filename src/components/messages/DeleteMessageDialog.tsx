import React from 'react';
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

interface DeleteMessageDialogProps {
  isOpen: boolean;
  isOwn: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}

const DeleteMessageDialog: React.FC<DeleteMessageDialogProps> = ({
  isOpen, isOwn, onClose, onDeleteForMe, onDeleteForEveryone,
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="rounded-2xl max-w-xs mx-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete message?</AlertDialogTitle>
          <AlertDialogDescription>
            Choose how you want to delete this message.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          {isOwn && (
            <AlertDialogAction
              onClick={onDeleteForEveryone}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full"
            >
              Delete for everyone
            </AlertDialogAction>
          )}
          <AlertDialogAction
            onClick={onDeleteForMe}
            className="bg-muted text-foreground hover:bg-muted/80 w-full"
          >
            Delete for me
          </AlertDialogAction>
          <AlertDialogCancel className="w-full mt-0">Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteMessageDialog;
