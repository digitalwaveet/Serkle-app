import { useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  MapPin,
  Maximize2,
  Pause,
  Play,
} from "lucide-react";
import { useChatMediaUrls } from "@/hooks/useChatMediaUrls";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
interface Props {
  content: string;
  messageType: string;
  attachmentUrl?: string | null;
  isOwn: boolean;
  onInvitationClick?: (id: string) => void;
  onOpenMedia?: () => void;
}
function Text({ content }: { content: string }) {
  return (
    <>
      {content.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 break-all"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
export default function MessageBubble({
  content,
  messageType,
  attachmentUrl: reference,
  onInvitationClick,
  onOpenMedia,
}: Props) {
  const media = useChatMediaUrls([reference]),
    url = media.url(reference);
  if (reference && !url)
    return media.failed(reference) ? (
      <button type="button" onClick={media.retry} className="msg-button quiet">
        Attachment unavailable · Retry
      </button>
    ) : (
      <SerkleLoader size="sm" label="Loading private attachment" />
    );
  if (messageType === "photo" && url)
    return <Photo url={url} caption={content} onOpen={onOpenMedia} />;
  if (messageType === "video" && url)
    return <Video url={url} caption={content} onOpen={onOpenMedia} />;
  if ((messageType === "voice" || messageType === "audio") && url)
    return <Voice url={url} content={content} />;
  if (["file", "document", "pdf"].includes(messageType) && url)
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-2 min-h-11"
      >
        <Download aria-hidden="true" className="size-6 shrink-0" />
        <span className="break-all">{content || "Open attachment"}</span>
        <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      </a>
    );
  if (messageType === "location" && url)
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 min-h-11 p-2"
      >
        <MapPin aria-hidden="true" />
        <span>{content || "Open shared location"}</span>
        <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      </a>
    );
  const invitation = content.match(
    /\[([^\]]+)\]\(circle-invitation:([a-f0-9-]+)\)/i,
  );
  if (invitation) {
    const [before, after] = content.split(invitation[0]);
    return (
      <p className="whitespace-pre-wrap break-words" dir="auto">
        {before}
        <button
          className="underline font-semibold"
          onClick={() => onInvitationClick?.(invitation[2])}
        >
          {invitation[1]}
        </button>
        {after}
      </p>
    );
  }
  return (
    <p className="whitespace-pre-wrap break-words min-w-0" dir="auto">
      <Text content={content} />
    </p>
  );
}
function Photo({
  url,
  caption,
  onOpen,
}: {
  url: string;
  caption: string;
  onOpen?: () => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading"),
    [attempt, setAttempt] = useState(0);
  return (
    <div className="max-w-[300px]">
      {state === "loading" && <SerkleLoader size="sm" label="Loading photo" />}
      {state === "failed" ? (
        <button
          className="msg-button quiet"
          onClick={() => {
            setState("loading");
            setAttempt((value) => value + 1);
          }}
        >
          Photo unavailable · Retry
        </button>
      ) : (
        <button
          type="button"
          className="block w-full rounded-lg overflow-hidden"
          aria-label="Open shared photo"
          disabled={!onOpen || state !== "ready"}
          onClick={onOpen}
        >
          <img
            key={attempt}
            src={url}
            alt={
              caption === "📷 Photo"
                ? "Shared photo"
                : caption || "Shared photo"
            }
            className="max-h-80 w-full object-contain"
            onLoad={() => setState("ready")}
            onError={() => setState("failed")}
          />
        </button>
      )}
      {caption && caption !== "📷 Photo" && (
        <p className="px-2 pt-2 pb-1 whitespace-pre-wrap" dir="auto">
          {caption}
        </p>
      )}
    </div>
  );
}
function Video({
  url,
  caption,
  onOpen,
}: {
  url: string;
  caption: string;
  onOpen?: () => void;
}) {
  const [error, setError] = useState(false),
    ref = useRef<HTMLVideoElement>(null);
  return (
    <div className="max-w-[320px]">
      <video
        ref={ref}
        src={url}
        controls
        playsInline
        preload="metadata"
        aria-label={caption || "Shared video"}
        className="max-h-80 w-full rounded-lg"
        onError={() => setError(true)}
        onLoadedMetadata={() => setError(false)}
      />
      {error && (
        <button
          className="msg-button quiet"
          onClick={() => {
            setError(false);
            ref.current?.load();
          }}
        >
          Video unavailable · Retry
        </button>
      )}
      {onOpen && (
        <button className="msg-button quiet" onClick={onOpen}>
          <Maximize2 aria-hidden="true" className="size-4" />
          Open video viewer
        </button>
      )}
      {caption && caption !== "🎥 Video" && (
        <p className="p-2 whitespace-pre-wrap" dir="auto">
          {caption}
        </p>
      )}
    </div>
  );
}
function Voice({ url, content }: { url: string; content: string }) {
  const ref = useRef<HTMLAudioElement>(null),
    [playing, setPlaying] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [current, setCurrent] = useState(0),
    [duration, setDuration] = useState(0);
  const supplied = Number(content.match(/\((\d+)s\)/)?.[1] || 0),
    total = Number.isFinite(duration) && duration > 0 ? duration : supplied;
  const format = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0")}`;
  const toggle = async () => {
    try {
      if (!ref.current) return;
      if (playing) ref.current.pause();
      else await ref.current.play();
      setError("");
    } catch {
      setError("Audio could not be played. Please retry.");
    }
  };
  return (
    <div className="msg-voice">
      <audio
        ref={ref}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => {
          setDuration(ref.current?.duration || 0);
          setLoading(false);
        }}
        onCanPlay={() => setLoading(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setCurrent(ref.current?.currentTime || 0)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onError={() => {
          setLoading(false);
          setPlaying(false);
          setError("Audio unavailable. Please retry.");
        }}
      />
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="msg-icon shrink-0"
          aria-label={playing ? "Pause voice message" : "Play voice message"}
          disabled={loading || !!error}
          onClick={() => void toggle()}
        >
          {loading ? (
            <SerkleLoader size="xs" label="Loading audio" />
          ) : playing ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
        </button>
        <div className="msg-voice-wave" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <i
              key={i}
              style={{
                height: 6 + ((i * 7) % 19),
                opacity: total && i / 28 <= current / total ? 1 : 0.4,
              }}
            />
          ))}
        </div>
        {total > 0 && (
          <span className="text-xs tabular-nums">
            {format(playing ? current : total)}
          </span>
        )}
      </div>
      {error && (
        <p className="text-sm" role="alert">
          {error}
          <button
            className="msg-button quiet"
            onClick={() => {
              setError("");
              setLoading(true);
              ref.current?.load();
            }}
          >
            Retry audio
          </button>
        </p>
      )}
    </div>
  );
}
