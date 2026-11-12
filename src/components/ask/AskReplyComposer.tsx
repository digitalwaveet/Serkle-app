import React, { useEffect, useId, useRef, useState } from "react";
import { Send, Glasses } from "lucide-react";
import MentionTextarea from "@/components/MentionTextarea";
import EmojiPicker from "@/components/EmojiPicker";
import { GiftEmojiPicker, GiftEmoji } from "@/components/GiftEmojiPicker";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
import { anonymousTextColor } from "@/lib/askPresentation";
interface Props {
  onSubmit: (text: string) => Promise<void>;
  onGiftSend?: (gift: GiftEmoji) => void | Promise<void>;
  isGiftSending?: boolean;
  recipientId?: string;
  recipientName?: string;
  placeholder?: string;
  displayName?: string;
  displayAvatar?: string;
  displayColor?: string;
  identityLabel?: string;
}
export function AskReplyComposer({
  onSubmit,
  onGiftSend,
  isGiftSending = false,
  recipientId,
  recipientName,
  placeholder = "Share your perspective…",
  displayName,
  displayAvatar,
  displayColor,
  identityLabel = "Your profile",
}: Props) {
  const id = useId();
  const [text, setText] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = "auto";
      textarea.current.style.height =
        Math.min(144, textarea.current.scrollHeight) + "px";
    }
  }, [text]);
  const submit = async () => {
    if (lock.current || !text.trim()) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await onSubmit(text.trim());
      setText("");
    } catch {
      setError("Your reply could not be posted. Your text is still here.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <form
      className="ask-ui ask-reply-composer"
      aria-label="Write a reply"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="ask-reply-inner">
        {error && (
          <p role="alert" className="ask-error">
            {error}
          </p>
        )}
        <div className="ask-reply-identity">Posting as {identityLabel}</div>
        <div className="ask-reply-row">
          <span
            className="ask-author-avatar"
            style={
              displayColor
                ? {
                    backgroundColor: displayColor,
                    color: anonymousTextColor(displayColor),
                  }
                : undefined
            }
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt="" />
            ) : displayName ? (
              <span>{displayName.slice(0, 2)}</span>
            ) : (
              <Glasses className="size-4" aria-hidden="true" />
            )}
          </span>
          <label className="sr-only" htmlFor={id}>
            Your reply
          </label>
          <MentionTextarea
            id={id}
            value={text}
            onChange={setText}
            disabled={pending}
            textareaRef={textarea}
            placeholder={placeholder}
            className="ask-reply-input"
            rows={1}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          {!pending && (
            <>
              <EmojiPicker
                variant="compact"
                onEmojiSelect={(emoji) => {
                  setText((value) => value + emoji);
                  textarea.current?.focus();
                }}
              />
              {recipientId && onGiftSend && (
                <GiftEmojiPicker
                  onGiftSelect={onGiftSend}
                  isSending={isGiftSending}
                  recipientId={recipientId}
                  recipientName={recipientName}
                />
              )}
            </>
          )}
          <button
            className="ask-reply-send"
            type="submit"
            aria-label="Post reply"
            disabled={pending || !text.trim()}
          >
            {pending ? (
              <SerkleLoader
                size="xs"
                label="Posting reply"
                className="text-current"
              />
            ) : (
              <Send aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
