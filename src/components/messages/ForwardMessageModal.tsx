import { useEffect, useRef, useState } from "react";
import { Check, Search, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Conversation } from "@/hooks/useConversations";
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
  onClose: () => void;
  conversations: Conversation[];
  onForward: (
    ids: string[],
    messageIds: Record<string, string>,
  ) => Promise<unknown> | void;
}
export default function ForwardMessageModal({
  isOpen,
  onClose,
  conversations,
  onForward,
}: Props) {
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const ids = useRef<Record<string, string>>({}),
    lock = useRef(false);
  useEffect(() => {
    if (isOpen) {
      ids.current = {};
      setError("");
      setSelected([]);
      setSearch("");
    }
  }, [isOpen]);
  const filtered = conversations.filter((c) =>
    (c.group_name || c.other_user_name || "")
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent busy={pending}>
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
          <DialogDescription>
            Choose one or more conversations.
          </DialogDescription>
        </DialogHeader>
        <div className="msg-dialog-body">
          <label className="sr-only" htmlFor="forward-search">
            Search forwarding destinations
          </label>
          <input
            id="forward-search"
            type="search"
            placeholder="Search conversations"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="max-h-[40dvh] overflow-y-auto mt-3">
            {filtered.length ? (
              filtered.map((c) => (
                <button
                  className="msg-setting"
                  key={c.conversation_id}
                  aria-pressed={selected.includes(c.conversation_id)}
                  disabled={pending}
                  onClick={() =>
                    setSelected((previous) =>
                      previous.includes(c.conversation_id)
                        ? previous.filter((id) => id !== c.conversation_id)
                        : [...previous, c.conversation_id],
                    )
                  }
                >
                  <Avatar className="msg-avatar h-10 w-10 rounded-xl">
                    <AvatarImage
                      src={
                        (c.is_group
                          ? c.group_avatar_url
                          : c.other_user_avatar) || undefined
                      }
                      alt=""
                    />
                    <AvatarFallback className="msg-avatar">
                      {c.is_group ? (
                        <Users aria-hidden="true" />
                      ) : (
                        c.other_user_initials
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1">
                    {c.group_name || c.other_user_name}
                  </span>
                  {selected.includes(c.conversation_id) && (
                    <Check aria-hidden="true" />
                  )}
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-6">
                No matching conversations.
              </p>
            )}
          </div>
          {error && (
            <p className="msg-error" role="alert">
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
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setPending(true);
              setError("");
              selected.forEach((id) => {
                ids.current[id] ??= crypto.randomUUID();
              });
              try {
                await onForward(selected, ids.current);
                onClose();
              } catch {
                setError(
                  "This message could not be forwarded. Your selections are still here; please try again.",
                );
              } finally {
                lock.current = false;
                setPending(false);
              }
            }}
          >
            {pending && <SerkleLoader size="xs" label="Forwarding message" />}
            Forward{selected.length ? ` to ${selected.length}` : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
