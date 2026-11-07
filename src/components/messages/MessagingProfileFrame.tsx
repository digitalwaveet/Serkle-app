import { type ReactNode } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./MessagingDialog";
export default function MessagingProfileFrame({
  open,
  onClose,
  title,
  children,
  presentation = "dialog",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  presentation?: "dialog" | "panel";
  busy?: boolean;
}) {
  if (!open) return null;
  if (presentation === "panel")
    return (
      <aside className="msg-ui msg-profile-panel" aria-label={title}>
        <header className="msg-profile-panel-header">
          <h2>{title}</h2>
          <button
            className="msg-icon"
            aria-label={`Close ${title.toLowerCase()}`}
            disabled={busy}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="msg-profile-panel-body">{children}</div>
      </aside>
    );
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent busy={busy} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="msg-dialog-body">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
