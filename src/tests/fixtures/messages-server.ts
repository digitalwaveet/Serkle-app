import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild } from "vite";
export async function startMessagesServer() {
  let signed = 0;
  const mediaReads = new Map<string, number>();
  const source = await readFile(
    new URL("./messages-client.ts", import.meta.url),
    "utf8",
  );
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.vite-messages-ui",
    resolve: {
      alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) },
    },
    optimizeDeps: {
      entries: ["src/tests/fixtures/messages-ui.tsx"],
      include: [
        "@supabase/supabase-js",
        "react/jsx-runtime",
        "react",
        "react-dom/client",
        "react-router-dom",
        "@tanstack/react-query",
        "@radix-ui/react-dialog",
        "@radix-ui/react-avatar",
      ],
    },
    server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
    plugins: [
      {
        name: "isolated-messages",
        enforce: "pre",
        resolveId(raw) {
          const path = raw.replace(/\\/g, "/");
          if (
            raw === "virtual:messages-client" ||
            /\/(?:contexts\/UserContext|integrations\/supabase\/client|hooks\/(?:useConversations|useMessages|useMessageActions|useUnreadCount|usePresence|useTypingIndicator|useGlobalTyping|useGroupManagement|useCircleInvitations|useChatMediaUrls|useSharedChatHistory)|lib\/(?:sync|chatMedia))(?:\.tsx?)?$/.test(
              path,
            )
          )
            return "\0messages-client";
          if (
            /\/components\/circles\/CircleInvitationModal(?:\.tsx)?$/.test(path)
          )
            return "\0messages-invitation";
        },
        async load(id) {
          if (id.endsWith("?messaging-media")) {
            const filename = id.split("?")[0];
            let original = await readFile(filename, "utf8");
            original = original
              .replace(
                /(["'])@\/hooks\/useChatMediaUrls\1/g,
                '"@/hooks/useChatMediaUrls.ts?messaging-media"',
              )
              .replace(
                /(["'])@\/lib\/chatMedia\1/g,
                '"@/lib/chatMedia.ts?messaging-media"',
              );
            return (
              await transformWithEsbuild(original, filename, {
                loader: filename.endsWith(".tsx") ? "tsx" : "ts",
                target: "es2020",
              })
            ).code;
          }
          if (id === "\0messages-client")
            return (
              await transformWithEsbuild(source, "messages-client.ts", {
                loader: "ts",
                target: "es2020",
              })
            ).code;
          if (id === "\0messages-invitation")
            return "export default function CircleInvitationModal(){return null;}";
        },
        configureServer(instance) {
          instance.middlewares.use(async (req, res, next) => {
            const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
            if (requestUrl.pathname.startsWith("/storage/v1/object/sign/")) {
              if (req.method === "POST") {
                if (req.headers.authorization !== "Bearer fixture-owner") {
                  res.writeHead(401, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ message: "Sign in required" }));
                  return;
                }
                if (req.url?.includes("forbidden")) {
                  res.writeHead(403, { "Content-Type": "application/json" });
                  res.end(
                    JSON.stringify({ message: "Attachment unavailable" }),
                  );
                  return;
                }
                if (req.url?.includes("pending"))
                  await new Promise((resolve) => setTimeout(resolve, 1500));
                signed++;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    signedURL:
                      requestUrl.pathname.replace("/storage/v1", "") +
                      `?token=fixture-${signed}`,
                  }),
                );
                return;
              }
              const count = (mediaReads.get(requestUrl.pathname) || 0) + 1;
              mediaReads.set(requestUrl.pathname, count);
              if (
                requestUrl.searchParams.get("token") === "expired" ||
                (requestUrl.pathname.includes("retry") && count === 1) ||
                requestUrl.pathname.includes("missing")
              ) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ message: "Object unavailable" }));
                return;
              }
              res.setHeader("Content-Type", "image/svg+xml");
              res.end(
                '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#e7c5a1"/><path d="M0 480 240 100 640 480" fill="#713a20"/></svg>',
              );
              return;
            }
            if (
              requestUrl.pathname.startsWith(
                "/storage/v1/object/public/post-media/",
              )
            ) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ message: "Bucket not found" }));
              return;
            }
            if (requestUrl.pathname === "/__messages_media_calls") {
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  signed,
                  reads: [...mediaReads.values()].reduce(
                    (sum, count) => sum + count,
                    0,
                  ),
                }),
              );
              return;
            }
            if (
              req.url?.startsWith("/messages") ||
              req.url?.startsWith("/login")
            ) {
              res.setHeader("Content-Type", "text/html");
              res.end(
                '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/src/tests/fixtures/messages-ui.tsx"></script></body></html>',
              );
            } else if (req.url?.startsWith("/sample/")) {
              res.setHeader("Content-Type", "image/svg+xml");
              res.end(
                '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="#e7c5a1"/><circle cx="440" cy="130" r="48" fill="#fff4e7"/><path d="M0 380 220 120 400 420H0M250 420 460 200 640 420" fill="#713a20"/><text x="30" y="390" fill="white" font-size="25">A shared moment</text></svg>',
              );
            } else next();
          });
        },
      },
    ],
  });
  await server.listen();
  return server;
}
