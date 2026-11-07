import { useRef, useState } from "react";
import FriendPicker from "@/components/circles/FriendPicker";
import { useCreateConversation } from "@/hooks/useConversations";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from "./MessagingDialog";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
export default function NewConversationModal({
  open,
  onClose,
  currentUserId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  onCreated: (id: string) => void;
}) {
  const [selected, setSelected] = useState<any[]>([]),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const { createConversation } = useCreateConversation(),
    lock = useRef(false);
  const submit = async () => {
    if (lock.current || !selected[0]) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const id = await createConversation(currentUserId, selected[0].id);
      onCreated(id);
      onClose();
    } catch {
      setError("This conversation could not be opened. Please try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
    >
      <DialogContent busy={pending}>
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            Choose a friend to start or continue a conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="msg-dialog-body">
          <FriendPicker
            multiSelect={false}
            selected={selected}
            onSelect={setSelected}
          />
          {error && (
            <p role="alert" className="msg-error">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <button
            className="msg-button secondary"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="msg-button primary"
            disabled={pending || !selected.length}
            onClick={() => void submit()}
          >
            {pending && <SerkleLoader size="xs" label="Opening conversation" />}
            Open conversation
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
