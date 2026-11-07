import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../src/integrations/supabase/client.ts", import.meta.url),
  "utf8",
);
const fallback = (name) =>
  source
    .split("\n")
    .find((line) => line.startsWith(`const ${name} =`))
    ?.match(/\|\|\s*["']([^"']+)["']/)?.[1];
const base = process.env.VITE_SUPABASE_URL || fallback("SUPABASE_URL");
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  fallback("SUPABASE_PUBLISHABLE_KEY");
if (!base || !key)
  throw new Error(
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Use a publishable/anon key only.",
  );
const checks = [
  [
    "group invitations",
    "get_chat_group_invite",
    { p_token: "00000000-0000-4000-8000-000000000000" },
  ],
  [
    "delivery permissions",
    "chat_message_access",
    { p_message_id: "00000000-0000-4000-8000-000000000000" },
  ],
];
let ready = true;
for (const [label, name, args] of checks) {
  try {
    // Read-only functions and an anonymous session: no group, message or user data is changed.
    const response = await fetch(
      `${base}/rest/v1/rpc/${name}?${new URLSearchParams(args)}`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    const body = await response.json();
    if (response.status === 401 && body.code === "42501")
      console.log(`OK: ${label} installed; anonymous access denied.`);
    else {
      ready = false;
      console.log(
        `NOT READY: ${label} (${response.status}, ${body.code || "unexpected response"}). ${body.code === "PGRST202" ? "Apply the matching messaging SQL migration." : "Check the deployment and function permissions."}`,
      );
    }
  } catch {
    ready = false;
    console.log(
      `NOT READY: ${label} could not be reached. Check the project URL and network.`,
    );
  }
}
process.exitCode = ready ? 0 : 1;
