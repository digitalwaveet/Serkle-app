import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { chatRpc } from "@/hooks/useGroupManagement";
import { syncConversations } from "@/lib/sync";
import { messageCount } from "@/lib/messagingPresentation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./MessagingDialog";
import { MessagingLoading } from "./MessagingState";
interface Props {
  token: string;
  userId: string;
  onClose: () => void;
  onJoined: (id: string) => void;
}
export default function InviteGroupDialog({
  token,
  userId,
  onClose,
  onJoined,
}: Props) {
  const valid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      token,
    );
  const query = useQuery({
    queryKey: ["chat-invite", token, userId],
    queryFn: () =>
      chatRpc<{
        name: string;
        avatar_url: string | null;
        expires_at: string;
        member_count: number;
        already_member: boolean;
      }>("get_chat_group_invite", { p_token: token }),
    enabled: valid,
    retry: false,
  });
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent busy={pending}>
        <DialogHeader>
          <DialogTitle>Group invitation</DialogTitle>
          <DialogDescription>
            Review this invitation before joining.
          </DialogDescription>
        </DialogHeader>
        <div className="msg-dialog-body">
          {valid && query.isLoading ? (
            <MessagingLoading label="Checking invitation" />
          ) : !valid || query.isError || !query.data ? (
            <>
              <p role="alert" className="msg-error">
                This invitation is invalid, expired, or unavailable. Ask a group
                administrator for a new link.
              </p>
              {valid && (
                <button
                  className="msg-button secondary"
                  onClick={() => void query.refetch()}
                >
                  Retry invitation
                </button>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold">{query.data.name}</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {messageCount(query.data.member_count, "member")}
              </p>
              <p className="text-sm mt-3">
                {query.data.already_member
                  ? "You are already a member."
                  : "Joining shares your profile with the group’s members."}
              </p>
            </>
          )}
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
            Close
          </button>
          {query.data && !query.isError && (
            <button
              className="msg-button primary"
              disabled={pending}
              onClick={async () => {
                if (lock.current) return;
                lock.current = true;
                setPending(true);
                setError("");
                try {
                  const id = await chatRpc<string>("join_chat_group", {
                    p_token: token,
                  });
                  await syncConversations(userId, true);
                  onJoined(id);
                } catch {
                  setError(
                    "The group could not be opened. Try again; an existing membership will be reused.",
                  );
                } finally {
                  lock.current = false;
                  setPending(false);
                }
              }}
            >
              {pending
                ? "Opening group…"
                : query.data.already_member
                  ? "Open group"
                  : "Join group"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
