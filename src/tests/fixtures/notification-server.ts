import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild } from "vite";
export async function startNotificationServer() {
  const source = await readFile(
    new URL("./notification-client.ts", import.meta.url),
    "utf8",
  );
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.vite-notification-ui",
    resolve: {
      alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) },
    },
    optimizeDeps: {
      entries: [
        "src/tests/fixtures/notification-ui.tsx",
        "src/tests/fixtures/notification-page-ui.tsx",
      ],
      include: [
        "react",
        "react-dom/client",
        "react-router-dom",
        "@tanstack/react-query",
        "@radix-ui/react-dialog",
        "@radix-ui/react-alert-dialog",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-switch",
        "@radix-ui/react-avatar",
      ],
    },
    server: { host: "127.0.0.1", port: 9001, hmr: false, watch: null },
    plugins: [
      {
        name: "isolated-notification-ui",
        enforce: "pre",
        resolveId(raw) {
          const path = raw.replace(/\\/g, "/");
          if (
            raw === "virtual:notification-client" ||
            /\/(?:contexts\/UserContext|integrations\/supabase\/client|hooks\/(?:useNotifications|useNotificationPreferences|useCoinWallet|useUnreadCount|useConversations)|utils\/cacheManager)(?:\.tsx?)?$/.test(
              path,
            )
          )
            return "\0notification-client";
          const modal =
            /(?:^|\/)(ProfileModal|SettingsModal|SearchModal|WalletModal)(?:\.tsx)?$/.exec(
              path,
            );
          if (modal) return "\0notification-stub";
        },
        async load(id) {
          if (id === "\0notification-client")
            return (
              await transformWithEsbuild(source, "notification-client.ts", {
                loader: "ts",
                target: "es2020",
              })
            ).code;
          if (id === "\0notification-stub")
            return "export default function Stub(){return null;}";
        },
        configureServer(instance) {
          instance.middlewares.use((req, res, next) => {
            if (
              req.url === "/notification-fixture" ||
              req.url === "/notification-page-fixture"
            ) {
              res.setHeader("Content-Type", "text/html");
              res.end(
                `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/src/tests/fixtures/${req.url === "/notification-page-fixture" ? "notification-page-ui" : "notification-ui"}.tsx"></script></body></html>`,
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
