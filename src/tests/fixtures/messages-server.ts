import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild } from "vite";
export async function startMessagesServer() {
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
          instance.middlewares.use((req, res, next) => {
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
