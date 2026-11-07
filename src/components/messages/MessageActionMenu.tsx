import {
  Copy,
  Forward,
  Pencil,
  Pin,
  Reply,
  SmilePlus,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./MessagingDialog";
interface Props {
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
export default function MessageActionMenu(props: Props) {
  const actions = [
    { Icon: Reply, label: "Reply", run: props.onReply },
    { Icon: SmilePlus, label: "React", run: props.onReact },
    { Icon: Forward, label: "Forward", run: props.onForward },
    { Icon: Copy, label: "Copy text", run: props.onCopy },
    ...(props.isOwn
      ? [{ Icon: Pencil, label: "Edit message", run: props.onEdit }]
      : []),
    { Icon: Pin, label: "Pin or unpin message", run: props.onPin },
    { Icon: Trash2, label: "Delete message", run: props.onDelete },
  ];
  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Message actions</DialogTitle>
        </DialogHeader>
        <div className="msg-dialog-body">
          {actions.map(({ Icon, label, run }) => (
            <button
              className={`msg-setting ${label === "Delete message" ? "text-destructive" : ""}`}
              key={label}
              onClick={run}
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
