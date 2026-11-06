import React, { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./AskDialog";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
export function AskConfirmDialog({
  open,
  onClose,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    if (open) setError("");
  }, [open]);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = async () => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch {
      setError("This item could not be deleted. Please try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) {
          setError("");
          onClose();
        }
      }}
    >
      <DialogContent
        role="alertdialog"
        busy={pending}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancel.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="ask-dialog-body">
          {error && (
            <p role="alert" className="ask-error">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              ref={cancel}
              className="ask-button ask-button--secondary"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="ask-button ask-button--danger"
              disabled={pending}
              onClick={() => void confirm()}
            >
              {pending && (
                <SerkleLoader
                  size="xs"
                  label="Deleting"
                  className="text-current"
                />
              )}
              Delete
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
