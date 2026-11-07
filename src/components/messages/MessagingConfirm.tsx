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
export default function MessagingConfirm({
  open,
  onClose,
  title,
  description,
  action = "Confirm",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  action?: string;
  onConfirm: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <div className="msg-dialog-body">
            <p role="alert" className="msg-error">
              {error}
            </p>
          </div>
        )}
        <DialogFooter>
          <button
            ref={cancel}
            className="msg-button secondary"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="msg-button danger"
            disabled={pending}
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setPending(true);
              setError("");
              try {
                await onConfirm();
                onClose();
              } catch {
                setError(
                  "This action could not be completed. Please try again.",
                );
              } finally {
                lock.current = false;
                setPending(false);
              }
            }}
          >
            {pending && <SerkleLoader size="xs" label="Saving change" />}
            {action}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
