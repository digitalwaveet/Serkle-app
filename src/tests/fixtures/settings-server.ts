import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild } from "vite";
export async function startSettingsServer() {
  const source = await readFile(
    new URL("./settings-client.ts", import.meta.url),
    "utf8",
  );
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.vite-settings-ui",
    resolve: {
      alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) },
    },
    optimizeDeps: {
      entries: ["src/tests/fixtures/settings-ui.tsx"],
      include: [
        "react",
        "react-dom/client",
        "react-router-dom",
        "@radix-ui/react-dialog",
        "@radix-ui/react-alert-dialog",
        "@radix-ui/react-radio-group",
        "@radix-ui/react-switch",
      ],
    },
    server: { host: "127.0.0.1", port: 8999, hmr: false, watch: null },
    plugins: [
      {
        name: "isolated-settings",
        enforce: "pre",
        resolveId(raw) {
          const path = raw.replace(/\\/g, "/");
          if (
            raw === "virtual:settings-client" ||
            /\/(?:contexts\/UserContext|integrations\/supabase\/client|hooks\/usePushNotifications|utils\/queryPersister)(?:\.tsx?)?$/.test(
              path,
            )
          )
            return "\0settings-client";
        },
        async load(id) {
          if (id === "\0settings-client")
            return (
              await transformWithEsbuild(
                source,
                "src/tests/fixtures/settings-client.ts",
                { loader: "ts", target: "es2020" },
              )
            ).code;
        },
        configureServer(instance) {
          instance.middlewares.use((req, res, next) => {
            if (req.url?.startsWith("/settings-fixture")) {
              res.setHeader("Content-Type", "text/html");
              res.end(
                '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/src/tests/fixtures/settings-ui.tsx"></script></body></html>',
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
