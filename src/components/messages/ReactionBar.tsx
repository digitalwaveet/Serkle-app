import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./MessagingDialog";
const reactions = [
  ["👍", "Thumbs up"],
  ["❤️", "Heart"],
  ["😂", "Laugh"],
  ["😮", "Surprised"],
  ["😢", "Sad"],
  ["👏", "Applause"],
];
export default function ReactionBar({
  isOpen,
  onSelect,
  onClose,
  pending = false,
}: {
  isOpen: boolean;
  position: { x: number; y: number };
  onSelect: (emoji: string) => void;
  onClose: () => void;
  pending?: boolean;
}) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent busy={pending} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>React to message</DialogTitle>
        </DialogHeader>
        <div className="msg-dialog-body flex flex-wrap gap-2">
          {reactions.map(([emoji, label]) => (
            <button
              className="msg-icon text-2xl"
              key={emoji}
              aria-label={label}
              disabled={pending}
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
