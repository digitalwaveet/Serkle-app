import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncConversations } from "@/lib/sync";
import FriendPicker from "@/components/circles/FriendPicker";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from "./MessagingDialog";
interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  onGroupCreated: (id: string) => void;
}
export default function CreateGroupModal({
  open,
  onClose,
  currentUserId,
  onGroupCreated,
}: Props) {
  const [name, setName] = useState(""),
    [friends, setFriends] = useState<any[]>([]),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID()),
    lock = useRef(false);
  const memberIds = [...new Set(friends.map((friend) => friend.id))].filter(
    (id) => id !== currentUserId,
  );
  const submit = async () => {
    if (lock.current || !name.trim() || !memberIds.length) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const { data, error } = await (supabase.rpc as any)(
        "create_group_conversation",
        {
          _creator_id: currentUserId,
          _group_name: name.trim(),
          _member_ids: memberIds,
          _request_id: requestId.current,
        },
      );
      if (error) throw error;
      // Keep the same request ID when retrying a lost response; a second group must not be created.
      await syncConversations(currentUserId, true).catch(console.error);
      onGroupCreated(data as string);
      requestId.current = crypto.randomUUID();
      setName("");
      setFriends([]);
      onClose();
    } catch (failure) {
      const unavailable =
        !!failure &&
        typeof failure === "object" &&
        "code" in failure &&
        failure.code === "PGRST202";
      setError(
        unavailable
          ? "Group creation is temporarily unavailable because messaging setup is incomplete. Your selections are saved. Please contact the app administrator."
          : "Your group could not be created. Your selections are still here; please try again.",
      );
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
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Give your group a name and choose the people to include.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="msg-dialog-body msg-form-stack">
            <div>
              <label htmlFor="message-group-name">Group name</label>
              <input
                id="message-group-name"
                maxLength={80}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Give your group a name"
                disabled={pending}
              />
            </div>
            <div>
              <p className="text-sm mb-2">
                Members{" "}
                {memberIds.length
                  ? `· ${memberIds.length + 1}, including you`
                  : ""}
              </p>
              <FriendPicker
                multiSelect
                selected={friends}
                onSelect={setFriends}
              />
            </div>
            {error && (
              <p role="alert" className="msg-error">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="msg-button secondary"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="msg-button primary"
              disabled={pending || !name.trim() || !memberIds.length}
            >
              {pending && <SerkleLoader size="xs" label="Creating group" />}
              Create group
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
