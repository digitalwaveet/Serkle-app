import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./MessagingDialog";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
interface Props {
  isOpen: boolean;
  isOwn: boolean;
  onClose: () => void;
  onDeleteForMe: () => Promise<unknown> | void;
  onDeleteForEveryone: () => Promise<unknown> | void;
}
export default function DeleteMessageDialog({
  isOpen,
  isOwn,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
}: Props) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    cancel = useRef<HTMLButtonElement>(null);
  const run = async (callback: () => Promise<unknown> | void) => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await callback();
      onClose();
    } catch {
      setError("This message could not be deleted. Please try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        busy={pending}
        role="alertdialog"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancel.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Delete message?</DialogTitle>
          <DialogDescription>
            Delete for me hides this message from your conversation. Only your
            own messages can be deleted for everyone.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="msg-dialog-body">
            <p className="msg-error" role="alert">
              {error}
            </p>
          </div>
        )}
        <DialogFooter>
          <button
            className="msg-button secondary"
            ref={cancel}
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="msg-button secondary"
            disabled={pending}
            onClick={() => void run(onDeleteForMe)}
          >
            {pending && <SerkleLoader size="xs" label="Deleting message" />}
            Delete for me
          </button>
          {isOwn && (
            <button
              className="msg-button danger"
              disabled={pending}
              onClick={() => void run(onDeleteForEveryone)}
            >
              Delete for everyone
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
