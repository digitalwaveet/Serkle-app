import { useState } from "react";
import MediaGroupMosaic from "@/components/messages/MediaGroupMosaic.tsx?messaging-media";
import MessageBubble from "@/components/messages/MessageBubble.tsx?messaging-media";
import MediaLightbox from "@/components/messages/MediaLightbox.tsx?messaging-media";
import "@/components/messages/messages.css";
export default function MediaFixture() {
  const params = new URLSearchParams(location.search),
    count = Number(params.get("count") || 3),
    state = params.get("state") || "ready",
    cid = "10000000-0000-4000-8000-000000000001";
  const items = Array.from({ length: count }, (_, index) => ({
    id: `photo-${index}`,
    url: `${location.origin}/storage/v1/object/${state === "expired" ? "sign" : "public"}/post-media/${cid}/${state}-${index}.jpg${state === "expired" ? "?token=expired" : ""}`,
    type: "photo" as const,
  }));
  const [preview, setPreview] = useState<number | null>(null);
  return (
    <main className="msg-ui p-4 max-w-2xl mx-auto">
      <h1>Actual storage reader</h1>
      <div className="msg-message-row flex justify-end my-4">
        <div className="msg-message-column msg-media-column">
          <div className="msg-message-bubble own w-full">
            <MediaGroupMosaic
              items={items}
              isOwn
              timestamp="10:30"
              onOpenLightbox={setPreview}
            />
          </div>
        </div>
      </div>
      <section className="mt-6" aria-label="Single photo">
        <MessageBubble
          messageType="photo"
          content="A legacy photo"
          attachmentUrl={items[0].url}
          isOwn={false}
          onOpenMedia={() => setPreview(0)}
        />
      </section>
      {preview !== null && (
        <MediaLightbox
          items={items}
          initialIndex={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </main>
  );
}
