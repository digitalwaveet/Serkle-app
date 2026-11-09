import { useMemo, useState } from "react";
import {
  Download,
  FileText,
  Image,
  Link2,
  MoreHorizontal,
  Play,
  Video,
} from "lucide-react";
import { useChatMediaUrls } from "@/hooks/useChatMediaUrls";
import {
  categorizeChatContent,
  messageCount,
  messageDate,
  type SharedMessage,
} from "@/lib/messagingPresentation";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
import { MessagingState } from "./MessagingState";
import { OptimizedImage } from '@/components/ui/OptimizedImage';
export default function SharedChatContent({
  messages,
  onMediaSelect,
  onViewMessage,
}: {
  messages: SharedMessage[];
  onMediaSelect?: (reference: string, type: "photo" | "video") => void;
  onViewMessage?: (id: string) => void;
}) {
  const content = useMemo(() => categorizeChatContent(messages), [messages]),
    [tab, setTab] = useState<keyof typeof content>("media");
  const media = useChatMediaUrls(
    messages.filter(message => message.message_type !== 'photo').map((message) => message.attachment_url),
    true,
  );
  const items = content[tab];
  const unavailable = (reference: string) =>
    media.failed(reference) ? (
      <button className="msg-button quiet" onClick={media.retry}>
        Unavailable · Retry
      </button>
    ) : (
      <SerkleLoader size="xs" label="Loading private attachment" />
    );
  return (
    <section aria-label="Shared content">
      <div className="msg-tabs" role="group" aria-label="Shared content type">
        {(["media", "files", "links", "audio", "voice"] as const).map((key) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)} {content[key].length}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {messageCount(items.length, "loaded item")} · From loaded messages
      </p>
      {!items.length ? (
        <MessagingState
          title={`No ${tab} in these messages`}
          description="Shared content will appear here. Load older messages to look further back."
        />
      ) : tab === "media" ? (
        <div className="msg-media-grid">
          {content.media.map((item) => {
            const reference = item.attachment_url!,
              url = media.url(reference),
              video = item.message_type === "video";
            if (!video) return <div key={item.id} className="msg-media-tile">
              <OptimizedImage src={reference} alt={item.content || 'Shared photo'} size="thumb"
                className="h-full" imageClassName="object-cover" style={{ height: '100%', minHeight: 0, aspectRatio: 'auto' }}
                onOpen={onMediaSelect ? () => onMediaSelect(reference, 'photo') : undefined}
                openLabel={`Open photo from ${messageDate(item.created_at)}`} />
            </div>;
            return (
              <div key={item.id} className="msg-media-tile">
                {!url ? (
                  unavailable(reference)
                ) : (
                  <button
                    className="w-full h-full"
                    aria-label={`Open ${video ? "video" : "photo"} from ${messageDate(item.created_at)}`}
                    onClick={() =>
                      onMediaSelect?.(reference, video ? "video" : "photo")
                    }
                    disabled={!onMediaSelect}
                  >
                        <video src={url} muted playsInline preload="metadata" />
                        <span className="msg-icon">
                          <Play aria-hidden="true" />
                        </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : tab === "links" ? (
        content.links.map((link) => (
          <div className="msg-file-row" key={link.id}>
            <Link2 aria-hidden="true" />
            <a
              className="copy underline text-sm break-all"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.url}
            </a>
            {onViewMessage && (
              <button
                className="msg-icon"
                aria-label="View link in conversation"
                onClick={() => onViewMessage(link.messageId)}
              >
                <MoreHorizontal aria-hidden="true" />
              </button>
            )}
          </div>
        ))
      ) : (
        (items as SharedMessage[]).map((item) => {
          const reference = item.attachment_url!,
            url = media.url(reference),
            audio = tab === "audio" || tab === "voice";
          return (
            <div key={item.id} className="msg-file-row">
              <FileText aria-hidden="true" />
              <div className="copy">
                <strong>
                  {item.content ||
                    (audio ? "Audio attachment" : "File attachment")}
                </strong>
                <p>{messageDate(item.created_at)}</p>
                {!url ? (
                  unavailable(reference)
                ) : audio ? (
                  <audio
                    controls
                    src={url}
                    preload="metadata"
                    aria-label={
                      tab === "voice" ? "Voice message" : "Audio file"
                    }
                  />
                ) : null}
              </div>
              {!audio && url && (
                <a
                  className="msg-icon"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open shared file"
                >
                  <Download aria-hidden="true" />
                </a>
              )}
              {onViewMessage && (
                <button
                  className="msg-icon"
                  aria-label="View attachment in conversation"
                  onClick={() => onViewMessage(item.id)}
                >
                  <MoreHorizontal aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
