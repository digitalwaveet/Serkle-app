import { useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Camera,
  Check,
  ChevronRight,
  Image,
  Link2,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Shield,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FriendPicker from "@/components/circles/FriendPicker";
import {
  useGroupMembers,
  useGroupInfo,
  useGroupMute,
  useGroupPolls,
  chatRpc,
} from "@/hooks/useGroupManagement";
import { useSharedChatHistory } from "@/hooks/useSharedChatHistory";
import { messageCount } from "@/lib/messagingPresentation";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./MessagingDialog";
import MessagingProfileFrame from "./MessagingProfileFrame";
import MessagingConfirm from "./MessagingConfirm";
import { MessagingLoading, MessagingState } from "./MessagingState";
import SharedChatContent from "./SharedChatContent";
import PollMessageBubble from "./PollMessageBubble";
import InviteQrCode from "./InviteQrCode";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  groupName: string;
  groupAvatarUrl: string | null;
  currentUserId: string;
  createdBy?: string;
  onLeft?: () => void;
  presentation?: "dialog" | "panel";
  onViewMessage?: (id: string) => void;
  onMediaSelect?: (url: string, type: "photo" | "video") => void;
}
export default function GroupInfoModal({
  isOpen,
  onClose,
  conversationId,
  groupName,
  groupAvatarUrl,
  currentUserId,
  onLeft,
  presentation,
  onViewMessage,
  onMediaSelect,
}: Props) {
  const members = useGroupMembers(conversationId, isOpen, currentUserId),
    info = useGroupInfo(conversationId, isOpen, currentUserId),
    muting = useGroupMute(conversationId, currentUserId, isOpen),
    polls = useGroupPolls(conversationId, currentUserId, isOpen),
    history = useSharedChatHistory(conversationId, isOpen);
  const [tab, setTab] = useState("overview"),
    [editing, setEditing] = useState<"name" | "description" | null>(null),
    [value, setValue] = useState(""),
    [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false),
    [friends, setFriends] = useState<any[]>([]),
    [target, setTarget] = useState<any>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      action: string;
      run: () => Promise<unknown>;
    } | null>(null);
  const [invite, setInvite] = useState<{
      url: string;
      expiresAt: string;
    } | null>(null),
    [invitePending, setInvitePending] = useState(false),
    [muteOpen, setMuteOpen] = useState(false),
    [transferring, setTransferring] = useState(false),
    [newOwner, setNewOwner] = useState("");
  const [pollOpen, setPollOpen] = useState(false),
    [question, setQuestion] = useState(""),
    [options, setOptions] = useState(["", ""]),
    [anonymous, setAnonymous] = useState(false),
    [multiple, setMultiple] = useState(false);
  const pollRequest = useRef(crypto.randomUUID()),
    actionLock = useRef(false);
  const roleKnown =
    !members.isLoading && !members.error && !info.isLoading && !info.error;
  const self = members.members.find((member) => member.id === currentUserId),
    owner = roleKnown && info.groupInfo?.created_by === currentUserId,
    admin = roleKnown && !!self?.is_admin;
  const name = info.groupInfo?.group_name || groupName || "Group conversation",
    description = info.groupInfo?.description || "",
    avatar = info.groupInfo?.group_avatar_url || groupAvatarUrl;
  const avatarInput = useRef<HTMLInputElement>(null);
  const busy =
    members.promoteToAdmin.isPending ||
    members.demoteAdmin.isPending ||
    members.removeMember.isPending ||
    members.leaveGroup.isPending ||
    members.addMembers.isPending ||
    members.transferOwnership.isPending ||
    info.updateName.isPending ||
    info.updateDescription.isPending ||
    info.updateAvatar.isPending ||
    invitePending ||
    polls.createPoll.isPending;
  const run = async (callback: () => Promise<unknown>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setError("");
    try {
      await callback();
    } catch {
      setError("This change could not be saved. Please try again.");
    } finally {
      actionLock.current = false;
    }
  };
  const createInvite = () =>
    void run(async () => {
      setCopied(false);
      setInvitePending(true);
      try {
        const result = await chatRpc<{ token: string; expires_at: string }>(
          "create_chat_group_invite",
          { p_conversation_id: conversationId },
        );
        setInvite({
          url: `${window.location.origin}/messages?invite=${result.token}`,
          expiresAt: result.expires_at,
        });
      } finally {
        setInvitePending(false);
      }
    });
  const renderMember = (member: any) => (
    <div className="msg-member" key={member.id}>
      <Avatar className="msg-avatar">
        <AvatarImage src={member.avatar_url || undefined} alt="" />
        <AvatarFallback className="msg-avatar">
          {member.initials || member.name.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="copy">
        <strong>{member.id === currentUserId ? "You" : member.name}</strong>
        <p>{member.username ? `@${member.username}` : "Member"}</p>
      </div>
      {member.is_creator ? (
        <span className="msg-role">Owner</span>
      ) : member.is_admin ? (
        <span className="msg-role">Admin</span>
      ) : null}
      {admin && member.id !== currentUserId && !member.is_creator && (
        <button
          className="msg-icon"
          aria-label={`Manage ${member.name}`}
          onClick={() => {
            setError("");
            setTarget(member);
          }}
        >
          <MoreHorizontal aria-hidden="true" />
        </button>
      )}
    </div>
  );
  return (
    <>
      <MessagingProfileFrame
        open={isOpen}
        onClose={onClose}
        title="Group profile"
        presentation={presentation}
        busy={busy}
      >
        <div className="msg-profile-hero">
          <div className="relative">
            <Avatar className="msg-avatar">
              <AvatarImage src={avatar || undefined} alt="" />
              <AvatarFallback className="msg-avatar">
                <Users aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
            {admin && (
              <>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  className="hidden"
                  aria-label="Group avatar image"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file)
                      void run(() =>
                        info.updateAvatar.mutateAsync(file),
                      ).finally(() => {
                        if (avatarInput.current) avatarInput.current.value = "";
                      });
                  }}
                />
                <button
                  className="msg-icon absolute -bottom-2 -right-2 bg-background border border-border"
                  aria-label="Change group avatar"
                  disabled={busy}
                  onClick={() => avatarInput.current?.click()}
                >
                  <Camera aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <h2>{name}</h2>
          <p>
            Group ·{" "}
            {roleKnown
              ? messageCount(members.members.length, "member")
              : "Member count unavailable"}
          </p>
          {roleKnown && (
            <span className="msg-role">
              <Shield aria-hidden="true" />
              {owner
                ? "You’re the owner"
                : admin
                  ? "You’re an admin"
                  : "Group member"}
            </span>
          )}
        </div>
        <div className="msg-quick-actions">
          <button onClick={onClose}>
            <MessageSquare aria-hidden="true" />
            Open chat
          </button>
          {admin ? (
            <>
              <button
                onClick={() => {
                  setError("");
                  setAdding(true);
                }}
                disabled={busy}
              >
                <UserPlus aria-hidden="true" />
                Add members
              </button>
              <button onClick={createInvite} disabled={busy}>
                <Link2 aria-hidden="true" />
                {invitePending ? "Creating link…" : "Invite"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setTab("members")}>
                <Users aria-hidden="true" />
                Members
              </button>
              <button onClick={() => setTab("media")}>
                <Image aria-hidden="true" />
                Shared media
              </button>
            </>
          )}
        </div>
        {error && (
          <p role="alert" className="msg-error">
            {error}
          </p>
        )}
        {(members.error || info.error) && (
          <p className="msg-error" role="alert">
            Group details and permissions couldn’t be checked.
            <button
              className="msg-button quiet"
              onClick={() => {
                void members.refetch();
                void info.refetch();
              }}
            >
              Retry group details
            </button>
          </p>
        )}
        <div
          className="msg-tabs"
          role="group"
          aria-label="Group profile sections"
        >
          {["overview", "members", "media", "polls"].map((key) => (
            <button
              key={key}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
              {key === "members" && roleKnown
                ? ` ${members.members.length}`
                : ""}
            </button>
          ))}
        </div>
        {tab === "overview" && (
          <>
            <section className="msg-panel">
              <div className="msg-panel-heading">
                About this group
                {admin && (
                  <button
                    className="msg-icon"
                    aria-label="Edit group description"
                    disabled={busy}
                    onClick={() => {
                      setValue(description);
                      setEditing("description");
                      setError("");
                    }}
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                )}
              </div>
              <p>{description || "No description added."}</p>
              {admin && (
                <button
                  className="msg-button quiet"
                  onClick={() => {
                    setValue(name);
                    setEditing("name");
                    setError("");
                  }}
                >
                  Edit group name
                </button>
              )}
            </section>
            <section className="msg-panel py-1">
              <button
                className="msg-setting"
                aria-label={
                  muting.isMuted
                    ? "Unmute group notifications"
                    : "Mute group notifications"
                }
                disabled={
                  muting.isLoading ||
                  !!muting.error ||
                  muting.mute.isPending ||
                  muting.unmute.isPending
                }
                onClick={() =>
                  muting.isMuted
                    ? void run(() => muting.unmute.mutateAsync())
                    : setMuteOpen(true)
                }
              >
                {muting.isMuted ? (
                  <BellOff aria-hidden="true" />
                ) : (
                  <Bell aria-hidden="true" />
                )}
                <span>Notifications</span>
                <span className="detail">
                  {muting.isLoading
                    ? "Checking…"
                    : muting.error
                      ? "Unavailable"
                      : muting.isMuted
                        ? "Muted"
                        : "On"}
                  <ChevronRight aria-hidden="true" />
                </span>
              </button>
              <button className="msg-setting" onClick={() => setTab("media")}>
                <Image aria-hidden="true" />
                Shared content
                <span className="detail">
                  <ChevronRight aria-hidden="true" />
                </span>
              </button>
            </section>
            {muting.error && (
              <button
                className="msg-button quiet"
                onClick={() => void muting.refetch()}
              >
                Retry notification settings
              </button>
            )}
            <div className="msg-section-title">
              <h3>Members {roleKnown ? members.members.length : "—"}</h3>
              <button onClick={() => setTab("members")}>See all</button>
            </div>
            {members.isLoading ? (
              <MessagingLoading label="Loading group members" />
            ) : (
              members.members.slice(0, 3).map(renderMember)
            )}
            {owner ? (
              <button
                className="msg-setting"
                onClick={() => {
                  setError("");
                  setTransferring(true);
                }}
              >
                <Shield aria-hidden="true" />
                Transfer ownership
              </button>
            ) : roleKnown && self ? (
              <button
                className="msg-button danger mt-4"
                onClick={() =>
                  setConfirm({
                    title: "Leave this group?",
                    description:
                      "You’ll stop receiving new messages from this group. The group and other members will remain.",
                    action: "Leave group",
                    run: async () => {
                      await members.leaveGroup.mutateAsync(currentUserId);
                      if (onLeft) onLeft();
                      else onClose();
                    },
                  })
                }
              >
                <LogOut aria-hidden="true" />
                Leave group
              </button>
            ) : null}
          </>
        )}
        {tab === "members" &&
          (members.isLoading ? (
            <MessagingLoading label="Loading group members" />
          ) : members.error ? (
            <MessagingState
              title="Members couldn’t be loaded"
              description="Try loading this group again."
              onRetry={() => void members.refetch()}
            />
          ) : (
            <>
              {admin && (
                <button
                  className="msg-button secondary mb-3"
                  onClick={() => setAdding(true)}
                >
                  <UserPlus aria-hidden="true" />
                  Add members
                </button>
              )}
              {members.members.map(renderMember)}
            </>
          ))}
        {tab === "media" && (
          <>
            {history.error && (
              <p className="msg-error" role="alert">
                Shared content couldn’t be refreshed.
                <button
                  className="msg-button quiet"
                  onClick={() => void history.refetch()}
                >
                  Retry shared content
                </button>
              </p>
            )}
            {history.isLoading ? (
              <MessagingLoading label="Loading group content" />
            ) : (
              <SharedChatContent
                messages={history.messages}
                onMediaSelect={(url, type) => {
                  if (presentation !== "panel") {
                    onClose();
                    setTimeout(() => onMediaSelect?.(url, type), 100);
                  } else onMediaSelect?.(url, type);
                }}
                onViewMessage={(id) => {
                  if (presentation !== "panel") {
                    onClose();
                    setTimeout(() => onViewMessage?.(id), 100);
                  } else onViewMessage?.(id);
                }}
              />
            )}
            {history.hasNextPage && (
              <button
                className="msg-button secondary mt-4"
                disabled={history.isFetchingNextPage}
                onClick={() => void history.fetchNextPage()}
              >
                Load older shared content
              </button>
            )}
          </>
        )}
        {tab === "polls" && (
          <>
            {self && (
              <button
                className="msg-button secondary mb-4"
                onClick={() => {
                  setPollOpen(true);
                  setError("");
                }}
              >
                <Plus aria-hidden="true" />
                Create poll
              </button>
            )}
            {polls.isLoading ? (
              <MessagingLoading label="Loading group polls" />
            ) : polls.error ? (
              <MessagingState
                title="Polls couldn’t be loaded"
                description="Try loading the group’s polls again."
                onRetry={() => void polls.refetch()}
              />
            ) : !polls.polls.length ? (
              <MessagingState
                title="No polls yet"
                description="Create a poll to hear from the group."
              />
            ) : (
              polls.polls.map((poll: any) => (
                <section className="msg-panel" key={poll.id}>
                  <PollMessageBubble
                    pollId={poll.id}
                    currentUserId={currentUserId}
                    isOwn={poll.creator_id === currentUserId}
                  />
                </section>
              ))
            )}
          </>
        )}
        <Dialog
          open={!!editing}
          onOpenChange={(open) => {
            if (!open && !busy) setEditing(null);
          }}
        >
          <DialogContent busy={busy} aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {editing === "name"
                  ? "Edit group name"
                  : "Edit group description"}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  if (editing === "name")
                    await info.updateName.mutateAsync(value);
                  else await info.updateDescription.mutateAsync(value);
                  setEditing(null);
                });
              }}
            >
              <div className="msg-dialog-body">
                <label htmlFor="group-detail-value">
                  {editing === "name" ? "Group name" : "Description"}
                </label>
                <textarea
                  id="group-detail-value"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  maxLength={editing === "name" ? 80 : 1000}
                  disabled={busy}
                />
                {error && (
                  <p className="msg-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
              <DialogFooter>
                <button
                  type="button"
                  className="msg-button secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button
                  className="msg-button primary"
                  type="submit"
                  disabled={busy || (editing === "name" && !value.trim())}
                >
                  Save changes
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog
          open={adding}
          onOpenChange={(open) => {
            if (!open && !busy) setAdding(false);
          }}
        >
          <DialogContent busy={busy}>
            <DialogHeader>
              <DialogTitle>Add members</DialogTitle>
              <DialogDescription>
                Existing group members won’t be added again.
              </DialogDescription>
            </DialogHeader>
            <div className="msg-dialog-body">
              <FriendPicker
                multiSelect
                selected={friends}
                onSelect={setFriends}
              />
              {error && (
                <p className="msg-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <button
                className="msg-button secondary"
                disabled={busy}
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button
                className="msg-button primary"
                disabled={
                  busy ||
                  !friends.some(
                    (friend) =>
                      !members.members.some(
                        (member) => member.id === friend.id,
                      ),
                  )
                }
                onClick={() =>
                  void run(async () => {
                    const ids = friends
                      .map((friend) => friend.id)
                      .filter(
                        (id) =>
                          !members.members.some((member) => member.id === id),
                      );
                    await members.addMembers.mutateAsync(ids);
                    setFriends([]);
                    setAdding(false);
                  })
                }
              >
                Add selected members
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={!!target}
          onOpenChange={(open) => {
            if (!open && !busy) setTarget(null);
          }}
        >
          <DialogContent busy={busy}>
            <DialogHeader>
              <DialogTitle>Member actions</DialogTitle>
              <DialogDescription>{target?.name}</DialogDescription>
            </DialogHeader>
            <div className="msg-dialog-body">
              {error && (
                <p role="alert" className="msg-error">
                  {error}
                </p>
              )}
              <button
                className="msg-setting"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (target.is_admin)
                      await members.demoteAdmin.mutateAsync(target.id);
                    else await members.promoteToAdmin.mutateAsync(target.id);
                    setTarget(null);
                  })
                }
              >
                <Shield aria-hidden="true" />
                {target?.is_admin ? "Remove admin role" : "Make admin"}
              </button>
              <button
                className="msg-setting text-destructive"
                onClick={() => {
                  const member = target;
                  setTarget(null);
                  setConfirm({
                    title: "Remove this member?",
                    description: `${member.name} will no longer receive new group messages.`,
                    action: "Remove member",
                    run: () => members.removeMember.mutateAsync(member.id),
                  });
                }}
              >
                <LogOut aria-hidden="true" />
                Remove member
              </button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={!!invite}
          onOpenChange={(open) => {
            if (!open) setInvite(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite to this group</DialogTitle>
              <DialogDescription>
                Anyone with this link can join until it expires. Share it with
                people you want in the group.
              </DialogDescription>
            </DialogHeader>
            <div className="msg-dialog-body">
              <label htmlFor="group-invite-link">Invitation link</label>
              {invite && <InviteQrCode url={invite.url} />}
              <input
                id="group-invite-link"
                readOnly
                value={invite?.url || ""}
                onFocus={(event) => event.target.select()}
              />
              <p className="text-xs text-muted-foreground mt-3">
                Expires {invite && new Date(invite.expiresAt).toLocaleString()}
              </p>
              {error && (
                <p role="alert" className="msg-error">
                  {error}
                </p>
              )}
              <button
                className="msg-button secondary mt-4"
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(invite!.url);
                    setError("");
                    setCopied(true);
                  })
                }
              >
                Copy invitation link
              </button>
              {copied && (
                <p className="text-sm mt-2" role="status">
                  Invitation link copied
                </p>
              )}
              <button
                className="msg-button danger mt-3"
                onClick={() =>
                  setConfirm({
                    title: "Revoke invitation link?",
                    description:
                      "This link and its QR code will stop working. Existing members keep access.",
                    action: "Revoke link",
                    run: async () => {
                      await chatRpc("revoke_chat_group_invite", {
                        p_token: new URL(invite!.url).searchParams.get(
                          "invite",
                        ),
                      });
                      setInvite(null);
                    },
                  })
                }
              >
                Revoke invitation link
              </button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={muteOpen} onOpenChange={setMuteOpen}>
          <DialogContent busy={muting.mute.isPending}>
            <DialogHeader>
              <DialogTitle>Mute group notifications</DialogTitle>
              <DialogDescription>
                Unread messages and access to the group will remain.
              </DialogDescription>
            </DialogHeader>
            <div className="msg-dialog-body">
              {error && (
                <p role="alert" className="msg-error">
                  {error}
                </p>
              )}
              {(["1h", "24h", "forever"] as const).map((duration) => (
                <button
                  key={duration}
                  className="msg-setting"
                  disabled={muting.mute.isPending}
                  onClick={() =>
                    void run(async () => {
                      await muting.mute.mutateAsync(duration);
                      setMuteOpen(false);
                    })
                  }
                >
                  <BellOff aria-hidden="true" />
                  {duration === "1h"
                    ? "For 1 hour"
                    : duration === "24h"
                      ? "For 24 hours"
                      : "Until I turn it back on"}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={transferring}
          onOpenChange={(open) => {
            if (!open && !busy) setTransferring(false);
          }}
        >
          <DialogContent busy={busy}>
            <DialogHeader>
              <DialogTitle>Transfer ownership</DialogTitle>
              <DialogDescription>
                The selected member will become the owner. You’ll remain an
                admin and can leave afterwards.
              </DialogDescription>
            </DialogHeader>
            <div className="msg-dialog-body">
              {members.members
                .filter((member) => member.id !== currentUserId)
                .map((member) => (
                  <label className="msg-checkbox-label" key={member.id}>
                    <input
                      type="radio"
                      name="new-group-owner"
                      checked={newOwner === member.id}
                      onChange={() => setNewOwner(member.id)}
                    />
                    {member.name}
                  </label>
                ))}
              {error && (
                <p role="alert" className="msg-error">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <button
                className="msg-button secondary"
                onClick={() => setTransferring(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="msg-button primary"
                disabled={busy || !newOwner}
                onClick={() =>
                  void run(async () => {
                    await members.transferOwnership.mutateAsync(newOwner);
                    setTransferring(false);
                  })
                }
              >
                Transfer ownership
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={pollOpen}
          onOpenChange={(open) => {
            if (!open && !busy) setPollOpen(false);
          }}
        >
          <DialogContent busy={busy}>
            <DialogHeader>
              <DialogTitle>Create a poll</DialogTitle>
              <DialogDescription>
                Ask a question and add at least two choices.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await polls.createPoll.mutateAsync({
                    question: question.trim(),
                    options: options
                      .map((option) => option.trim())
                      .filter(Boolean),
                    is_anonymous: anonymous,
                    is_multiple_choice: multiple,
                    requestId: pollRequest.current,
                  });
                  setQuestion("");
                  setOptions(["", ""]);
                  setPollOpen(false);
                  pollRequest.current = crypto.randomUUID();
                });
              }}
            >
              <div className="msg-dialog-body msg-form-stack">
                <label htmlFor="poll-question">Question</label>
                <input
                  id="poll-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  required
                  maxLength={300}
                />
                {options.map((option, index) => (
                  <div className="flex items-center gap-2" key={index}>
                    <label className="sr-only" htmlFor={`poll-option-${index}`}>
                      Option {index + 1}
                    </label>
                    <input
                      id={`poll-option-${index}`}
                      value={option}
                      onChange={(event) =>
                        setOptions((previous) =>
                          previous.map((item, i) =>
                            i === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder={`Option ${index + 1}`}
                      maxLength={160}
                    />
                    {index > 1 && (
                      <button
                        type="button"
                        className="msg-icon"
                        aria-label={`Remove option ${index + 1}`}
                        onClick={() =>
                          setOptions((previous) =>
                            previous.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <X aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
                {options.length < 10 && (
                  <button
                    type="button"
                    className="msg-button quiet"
                    onClick={() => setOptions((previous) => [...previous, ""])}
                  >
                    <Plus aria-hidden="true" />
                    Add option
                  </button>
                )}
                <label className="msg-checkbox-label">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(event) => setAnonymous(event.target.checked)}
                  />
                  Anonymous voting
                </label>
                <label className="msg-checkbox-label">
                  <input
                    type="checkbox"
                    checked={multiple}
                    onChange={(event) => setMultiple(event.target.checked)}
                  />
                  Allow multiple choices
                </label>
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
                  disabled={busy}
                  onClick={() => setPollOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="msg-button primary"
                  type="submit"
                  disabled={
                    busy ||
                    !question.trim() ||
                    options.filter((option) => option.trim()).length < 2
                  }
                >
                  Create poll
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {confirm && (
          <MessagingConfirm
            open
            title={confirm.title}
            description={confirm.description}
            action={confirm.action}
            onConfirm={confirm.run}
            onClose={() => setConfirm(null)}
          />
        )}
      </MessagingProfileFrame>
    </>
  );
}
