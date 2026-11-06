import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild } from "vite";
export async function startAskServer() {
  const source = await readFile(
    new URL("./ask-client.ts", import.meta.url),
    "utf8",
  );
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.vite-ask-ui",
    resolve: {
      alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) },
    },
    optimizeDeps: {
      entries: ["src/tests/fixtures/ask-ui.tsx"],
      include: [
        "react",
        "react-dom/client",
        "react-router-dom",
        "@tanstack/react-query",
        "@radix-ui/react-dialog",
        "@radix-ui/react-radio-group",
        "@radix-ui/react-select",
        "@radix-ui/react-tabs",
        "@radix-ui/react-popover",
        "@radix-ui/react-avatar",
        "@radix-ui/react-tooltip",
      ],
    },
    server: { host: "127.0.0.1", port: 9003, hmr: false, watch: null },
    plugins: [
      {
        name: "isolated-ask",
        enforce: "pre",
        resolveId(raw) {
          const path = raw.replace(/\\/g, "/");
          if (
            raw === "virtual:ask-client" ||
            /\/(?:contexts\/UserContext|integrations\/supabase\/client|hooks\/(?:useQuestions|useAnswers|useThreadUpdates|useQuestionBookmarks|useStoryFollowers|useExpertProfiles|useExpertAnswers|useAskHistory|usePresence|useUserPosts|useConversations|useUnreadCount|useCircleInvitations))(?:\.tsx?)?$/.test(
              path,
            )
          )
            return "\0ask-client";
          if (/\/components\/(?:Header|InstallPrompt)(?:\.tsx)?$/.test(path))
            return "\0ask-stub:" + path.split("/").at(-1);
        },
        async load(id) {
          if (id === "\0ask-client")
            return (
              await transformWithEsbuild(source, "ask-client.ts", {
                loader: "ts",
                target: "es2020",
              })
            ).code;
          if (id.startsWith("\0ask-stub:"))
            return id.includes("InstallPrompt")
              ? "export function InstallPrompt(){return null;}"
              : `import React from 'react';export default function Header(){return React.createElement('header',{className:'h-12 border-b flex items-center px-4 bg-background'},React.createElement('img',{src:'/lovable-uploads/SerkleSecondaryLogo.svg',alt:'Serkle',className:'h-6'}));}`;
        },
        configureServer(instance) {
          instance.middlewares.use((req, res, next) => {
            if (req.url?.startsWith("/ask")) {
              res.setHeader("Content-Type", "text/html");
              res.end(
                '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/src/tests/fixtures/ask-ui.tsx"></script></body></html>',
              );
            } else if (req.url?.startsWith("/sample/")) {
              res.setHeader("Content-Type", "image/svg+xml");
              res.end(
                '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" rx="30" fill="#713a20"/></svg>',
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
