import { useRef, useState } from "react";
import { Image, Camera, Video, FileText, MapPin } from "lucide-react";
import { uploadChatMedia } from "@/lib/chatMedia";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./MessagingDialog";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
interface Props {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  senderId: string;
  onSendAttachment: (
    type: string,
    url: string,
    label: string,
    id?: string,
  ) => Promise<unknown> | void;
  onMediaSelected: (files: File[], type: "photo" | "video") => void;
}
export default function TelegramAttachmentSheet({
  open,
  onClose,
  conversationId,
  onSendAttachment,
  onMediaSelected,
}: Props) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    job = useRef<{
      file?: File;
      type: string;
      url: string;
      label: string;
      id: string;
    } | null>(null);
  const send = async () => {
    if (lock.current || !job.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const current = job.current;
      if (!current.url && current.file)
        current.url = await uploadChatMedia(
          conversationId,
          current.file,
          current.file.name,
        );
      await onSendAttachment(
        current.type,
        current.url,
        current.label,
        current.id,
      );
      job.current = null;
      onClose();
    } catch {
      setError(
        "This attachment could not be sent. Retry keeps the same attachment.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const choose = (files: File[], type: "photo" | "video") => {
    if (!files.length) return;
    if (files.some((file) => file.size > 50 * 1024 * 1024)) {
      setError("Choose files smaller than 50 MB.");
      return;
    }
    onClose();
    onMediaSelected(files, type);
  };
  const location = async () => {
    if (lock.current) return;
    if (!navigator.geolocation) {
      setError("Location sharing is unavailable on this device.");
      return;
    }
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
          }),
      );
      const { latitude, longitude } = position.coords;
      job.current = {
        id: crypto.randomUUID(),
        type: "location",
        url: `https://www.google.com/maps?q=${latitude},${longitude}`,
        label: `📍 Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      };
    } catch {
      setError(
        "Your location could not be found. Check location permission and try again.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
    if (job.current) await send();
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
          <DialogTitle>Add to your message</DialogTitle>
          <DialogDescription>
            Share media, a file, or your current location.
          </DialogDescription>
        </DialogHeader>
        <div className="msg-dialog-body">
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                {
                  label: "Photo",
                  Icon: Image,
                  accept: "image/*",
                  type: "photo",
                  multiple: true,
                },
                {
                  label: "Camera",
                  Icon: Camera,
                  accept: "image/*",
                  type: "photo",
                  capture: true,
                },
                {
                  label: "Video",
                  Icon: Video,
                  accept: "video/*",
                  type: "video",
                  multiple: true,
                },
                { label: "File", Icon: FileText, accept: "*/*", type: "file" },
              ] as const
            ).map((option) => (
              <label
                key={option.label}
                className="msg-attachment-choice relative flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer"
              >
                <option.Icon aria-hidden="true" />
                <span>{option.label}</span>
                <input
                  type="file"
                  aria-label={`Choose ${option.label.toLowerCase()}`}
                  accept={option.accept}
                  multiple={"multiple" in option && option.multiple}
                  capture={"capture" in option ? "environment" : undefined}
                  disabled={pending || !!job.current}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = "";
                    if (option.type === "file" && files[0]) {
                      job.current = {
                        file: files[0],
                        url: "",
                        label: `📎 ${files[0].name}`,
                        type: "file",
                        id: crypto.randomUUID(),
                      };
                      void send();
                    } else if (option.type !== "file")
                      choose(files, option.type);
                  }}
                />
              </label>
            ))}
            <button
              className="msg-attachment-choice flex flex-col items-center gap-2 p-4 rounded-xl"
              disabled={pending || !!job.current}
              onClick={() => void location()}
            >
              <MapPin aria-hidden="true" />
              Location
            </button>
          </div>
          {pending && <SerkleLoader size="sm" label="Preparing attachment" />}
          {error && (
            <p className="msg-error" role="alert">
              {error}
            </p>
          )}
          {job.current && !pending && (
            <div className="flex gap-2 mt-3">
              <button
                className="msg-button primary"
                onClick={() => void send()}
              >
                Retry attachment
              </button>
              <button
                className="msg-button secondary"
                onClick={() => {
                  job.current = null;
                  setError("");
                }}
              >
                Discard attachment
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
