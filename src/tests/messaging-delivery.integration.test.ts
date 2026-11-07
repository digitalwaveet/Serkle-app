import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  submitChatMessageBatch,
  chatDeliveryFailure,
  type ChatDeliveryPayload,
} from "../lib/chatDelivery.ts";
const db = new PGlite(),
  id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  member = id(2),
  outsider = id(3);
let dm: string,
  server: Server,
  base: string,
  loseResponse = false,
  hideAcknowledgements = false,
  writes = 0,
  missingGroup = false;
async function as<T = any>(
  user: string | null,
  run: (tx: any) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
      user || "",
    ]);
    await tx.exec(`SET LOCAL ROLE ${user ? "authenticated" : "anon"}`);
    return run(tx);
  });
}
async function rpc(user: string | null, name: string, args: unknown[] = []) {
  return as(
    user,
    async (tx) =>
      (
        await tx.query(
          `SELECT public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
          args,
        )
      ).rows[0]?.value,
  );
}
const client = (user = owner) =>
  createClient(base, "fixture-anon", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: "Bearer " + user } },
  });
const payload = (
  n: number,
  conversation = dm,
  sender = owner,
): ChatDeliveryPayload => ({
  id: id(n),
  conversation_id: conversation,
  sender_id: sender,
  content: "A sample queued message",
  message_type: "text",
  attachment_url: null,
  reply_to_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
before(async () => {
  for (const path of [
    "./fixtures/messaging.sql",
    "../../supabase/migrations/20260921090000_chat_privacy_and_receipts.sql",
    "../../supabase/migrations/20260921091000_guard_conversation_list.sql",
    "../../supabase/migrations/20261106190000_messaging_groups_and_polls.sql",
    "../../supabase/migrations/20261107140000_messaging_delivery_repair.sql",
  ]) {
    if (path.endsWith("20261107140000_messaging_delivery_repair.sql")) {
      await db.exec(`DROP FUNCTION public.get_user_conversations(uuid);
        CREATE FUNCTION public.get_user_conversations(_user_id uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
        CREATE FUNCTION public.get_or_create_conversation(_user1_id uuid,_user2_id uuid) RETURNS TABLE(conversation_id uuid) LANGUAGE sql AS $$ SELECT NULL::uuid $$;
        CREATE FUNCTION public.sync_messages(p_conversation_id uuid,p_after_seq bigint) RETURNS jsonb LANGUAGE sql AS $$ SELECT '[]'::jsonb $$;`);
    }
    await db.exec(await readFile(new URL(path, import.meta.url), "utf8"));
  }
  await db.exec(
    "CREATE TRIGGER trigger_set_message_seq BEFORE INSERT OR UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION set_message_seq()",
  );
  server = createServer(async (req, res) => {
    const send = (status: number, value: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        value === undefined
          ? ""
          : JSON.stringify(value, (_, item) =>
              typeof item === "bigint" ? Number(item) : item,
            ),
      );
    };
    const user = req.headers.authorization?.slice(7);
    if (![owner, member, outsider].includes(user || "")) {
      send(401, { code: "PGRST301", message: "Sign in required" });
      return;
    }
    try {
      const url = new URL(req.url || "/", base);
      let input: any = null;
      if (req.method === "POST") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        input = JSON.parse(Buffer.concat(chunks).toString());
      }
      if (url.pathname === "/rest/v1/rpc/create_group_conversation") {
        if (missingGroup) {
          send(404, {
            code: "PGRST202",
            message: "Could not find the function with _request_id",
          });
          return;
        }
        const value = await rpc(user!, "create_group_conversation", [
          input._creator_id,
          input._group_name,
          input._member_ids,
          input._request_id,
        ]);
        send(200, value);
        return;
      }
      if (url.pathname !== "/rest/v1/messages") {
        send(404, { message: "Unknown fixture route" });
        return;
      }
      if (req.method === "GET") {
        const ids = (url.searchParams.get("id") || "in.()")
          .slice(4, -1)
          .split(",")
          .map((value) => value.replace(/"/g, ""));
        const rows = await as(
          user!,
          async (tx) =>
            (
              await tx.query(
                "SELECT * FROM messages WHERE id=ANY($1::uuid[])",
                [ids],
              )
            ).rows,
        );
        send(200, hideAcknowledgements ? [] : rows);
        return;
      }
      if (req.method === "POST") {
        const rows = Array.isArray(input) ? input : [input];
        writes++;
        await as(user!, async (tx) => {
          for (const row of rows) {
            const columns = [
              "id",
              "conversation_id",
              "sender_id",
              "content",
              "message_type",
              "attachment_url",
              "reply_to_id",
              "created_at",
              "updated_at",
            ];
            await tx.query(
              `INSERT INTO messages(${columns.join(",")}) VALUES(${columns.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT(id) DO NOTHING`,
              columns.map((key) => row[key]),
            );
          }
        });
        if (loseResponse) {
          loseResponse = false;
          send(503, {
            code: "UPSTREAM_TIMEOUT",
            message: "Response lost after commit",
          });
          return;
        }
        send(201, undefined);
        return;
      }
      send(405, { message: "Method not allowed" });
    } catch (error: any) {
      send(error.code === "42501" ? 403 : 400, {
        code: error.code || "FIXTURE_ERROR",
        message: error.message,
      });
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.close();
});
beforeEach(async () => {
  await db.exec("TRUNCATE profiles,conversations CASCADE");
  await db.query(
    "INSERT INTO profiles(id,name,username,initials) SELECT id,'Sample user','sample','SU' FROM unnest($1::uuid[]) id",
    [[owner, member, outsider]],
  );
  dm = await rpc(owner, "get_or_create_conversation", [owner, member]);
  loseResponse = false;
  hideAcknowledgements = false;
  missingGroup = false;
  writes = 0;
});
test("actual Supabase SDK writes through HTTP and confirms the stored row and server sequences", async () => {
  const row = payload(10);
  const accepted = await submitChatMessageBatch(client(), [row]);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].id, row.id);
  assert.equal(accepted[0].seq, 1);
  assert.equal(accepted[0].created_seq, 1);
  assert.equal(writes, 1);
});
test("lost write response retries reuse the existing row without a second insert or sequence change", async () => {
  const row = payload(11);
  loseResponse = true;
  await assert.rejects(() => submitChatMessageBatch(client(), [row]));
  const accepted = await submitChatMessageBatch(client(), [row]);
  assert.equal(accepted[0].seq, 1);
  assert.equal(writes, 1);
  assert.equal((await db.query("SELECT * FROM messages")).rows.length, 1);
});
test("an unconfirmed response is never accepted as delivered and a later retry can confirm it", async () => {
  const row = payload(12);
  hideAcknowledgements = true;
  await assert.rejects(
    () => submitChatMessageBatch(client(), [row]),
    (error) => (error as any).code === "ACK_UNCONFIRMED",
  );
  hideAcknowledgements = false;
  await submitChatMessageBatch(client(), [row]);
  assert.equal(writes, 1);
});
test("forged senders and outsiders fail even with permissive legacy policies", async () => {
  await assert.rejects(
    () => submitChatMessageBatch(client(outsider), [payload(13, dm, outsider)]),
    (error) => (error as any).code === "42501",
  );
  await assert.rejects(
    () => submitChatMessageBatch(client(), [payload(14, dm, member)]),
    (error) => (error as any).code === "42501",
  );
  assert.equal((await db.query("SELECT * FROM messages")).rows.length, 0);
});
test("a rejected row rolls back its entire HTTP batch without a partial success", async () => {
  await assert.rejects(() =>
    submitChatMessageBatch(client(), [payload(15), payload(16, dm, outsider)]),
  );
  assert.equal((await db.query("SELECT * FROM messages")).rows.length, 0);
});
test("acknowledgement rejects an unrelated existing message rather than overwriting it", async () => {
  const row = payload(17);
  await submitChatMessageBatch(client(), [row]);
  await assert.rejects(
    () =>
      submitChatMessageBatch(client(), [
        { ...row, content: "Different attempted content" },
      ]),
    (error) => (error as any).code === "ACK_UNCONFIRMED",
  );
  assert.equal(writes, 1);
  assert.equal(
    (
      await db.query<{ content: string }>(
        "SELECT content FROM messages WHERE id=$1",
        [row.id],
      )
    ).rows[0].content,
    row.content,
  );
});
test("direct-message creation authenticates callers, excludes groups and reuses the same pair", async () => {
  const group = await rpc(owner, "create_group_conversation", [
    owner,
    "A group of two",
    [member],
    id(30),
  ]);
  assert.notEqual(group, dm);
  assert.equal(
    await rpc(member, "get_or_create_conversation", [member, owner]),
    dm,
  );
  await assert.rejects(
    () => rpc(outsider, "get_or_create_conversation", [owner, member]),
    /Not authorized/,
  );
  await assert.rejects(
    () => rpc(null, "get_or_create_conversation", [owner, member]),
    /permission denied/,
  );
});
test("direct membership and conversation inserts cannot bypass the authenticated RPCs", async () => {
  await assert.rejects(
    () =>
      as(outsider, (tx) =>
        tx.query(
          "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)",
          [dm, outsider],
        ),
      ),
    /row-level security/,
  );
  await assert.rejects(
    () =>
      as(owner, (tx) =>
        tx.query("INSERT INTO conversations(is_group) VALUES(false)"),
      ),
    /row-level security/,
  );
});
test("conversation and membership identities cannot be changed or read by another account", async () => {
  await assert.rejects(
    () =>
      as(owner, (tx) =>
        tx.query("UPDATE conversations SET current_seq=999 WHERE id=$1", [dm]),
      ),
    /Protected conversation/,
  );
  await assert.rejects(
    () =>
      as(owner, (tx) =>
        tx.query(
          "UPDATE conversation_members SET user_id=$1 WHERE conversation_id=$2 AND user_id=$3",
          [outsider, dm, member],
        ),
      ),
    /Membership identity/,
  );
  await as(owner, (tx) =>
    tx.query(
      "DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2",
      [dm, member],
    ),
  );
  assert.equal(
    (
      await db.query(
        "SELECT * FROM conversation_members WHERE conversation_id=$1",
        [dm],
      )
    ).rows.length,
    2,
  );
  assert.equal(
    (
      await as(outsider, (tx) =>
        tx.query("SELECT * FROM conversations WHERE id=$1", [dm]),
      )
    ).rows.length,
    0,
  );
});
test("actual group RPC works after the migration and the undeployed signature returns the real error class", async () => {
  const args = {
    _creator_id: owner,
    _group_name: "Weekend makers",
    _member_ids: [member, member],
    _request_id: id(31),
  };
  missingGroup = true;
  const missing = await client().rpc("create_group_conversation", args);
  assert.equal(missing.error?.code, "PGRST202");
  missingGroup = false;
  const first = await client().rpc("create_group_conversation", args),
    second = await client().rpc("create_group_conversation", args);
  assert.equal(first.error, null);
  assert.equal(first.data, second.data);
  assert.equal(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM conversation_members WHERE conversation_id=$1",
        [first.data],
      )
    ).rows[0].n,
    2,
  );
});
test("arrival counts, read receipts and per-user deletions stay consistent through backend sync", async () => {
  await submitChatMessageBatch(client(member), [payload(40, dm, member)]);
  await submitChatMessageBatch(client(), [payload(41)]);
  let list = await as(owner, (tx) =>
    tx.query("SELECT * FROM get_user_conversations($1)", [owner]),
  );
  assert.equal(Number(list.rows[0].unread_count), 1);
  await as(owner, (tx) =>
    tx.query(
      "INSERT INTO read_receipts(conversation_id,user_id,last_read_seq) VALUES($1,$2,999)",
      [dm, owner],
    ),
  );
  assert.equal(
    Number(
      (
        await db.query<{ last_read_seq: number }>(
          "SELECT last_read_seq FROM read_receipts",
        )
      ).rows[0].last_read_seq,
    ),
    2,
  );
  await as(owner, (tx) =>
    tx.query(
      "INSERT INTO message_deletions(message_id,user_id) VALUES($1,$2)",
      [id(40), owner],
    ),
  );
  const synced = await as(owner, (tx) =>
    tx.query("SELECT * FROM sync_messages($1,0)", [dm]),
  );
  assert.deepEqual(
    synced.rows.map((row: any) => row.id),
    [id(41)],
  );
  assert.equal(
    (
      await as(outsider, (tx) =>
        tx.query("SELECT * FROM sync_messages($1,0)", [dm]),
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    () => as(null, (tx) => tx.query("SELECT * FROM sync_messages($1,0)", [dm])),
    /permission denied/,
  );
});
test("deleted message content is also removed from the current user conversation preview", async () => {
  await submitChatMessageBatch(client(member), [
    {
      ...payload(42, dm, member),
      content: "Earlier visible message",
      created_at: "2026-11-07T07:00:00Z",
    },
  ]);
  await submitChatMessageBatch(client(), [
    {
      ...payload(43),
      content: "Hidden latest message",
      created_at: "2026-11-07T07:01:00Z",
    },
  ]);
  await as(owner, (tx) =>
    tx.query(
      "INSERT INTO message_deletions(message_id,user_id) VALUES($1,$2)",
      [id(43), owner],
    ),
  );
  const list = await as(owner, (tx) =>
    tx.query("SELECT * FROM get_user_conversations($1)", [owner]),
  );
  assert.equal(list.rows[0].last_message, "Earlier visible message");
  assert.equal((await db.query("SELECT * FROM messages")).rows.length, 2);
});
test("private media is scoped to conversation members and cross-chat attachment references are rejected", async () => {
  const path = `${dm}/${owner}/image.jpg`;
  await as(owner, (tx) =>
    tx.query("INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)", [
      "chat-media",
      path,
    ]),
  );
  assert.equal(
    (await as(member, (tx) => tx.query("SELECT * FROM storage.objects"))).rows
      .length,
    1,
  );
  assert.equal(
    (await as(outsider, (tx) => tx.query("SELECT * FROM storage.objects"))).rows
      .length,
    0,
  );
  const other = await rpc(owner, "get_or_create_conversation", [
    owner,
    outsider,
  ]);
  await assert.rejects(
    () =>
      submitChatMessageBatch(client(), [
        {
          ...payload(50, other),
          message_type: "photo",
          attachment_url: "chat-media://" + path,
        },
      ]),
    (error) => /Attachment must belong/.test((error as any).message),
  );
});
test("cross-conversation replies are rejected and retry failures distinguish auth, permissions, schema and network", async () => {
  await submitChatMessageBatch(client(), [payload(51)]);
  const other = await rpc(owner, "get_or_create_conversation", [
    owner,
    outsider,
  ]);
  await assert.rejects(
    () =>
      submitChatMessageBatch(client(), [
        { ...payload(52, other), reply_to_id: id(51) },
      ]),
    (error) => /Reply must belong/.test((error as any).message),
  );
  assert.match(chatDeliveryFailure({ code: "42501" }).message, /permission/);
  assert.match(chatDeliveryFailure({ code: "PGRST204" }).message, /update/);
  assert.match(chatDeliveryFailure({ status: 401 }).message, /Sign in/);
  assert.match(
    chatDeliveryFailure(new TypeError("fetch failed")).message,
    /connection/,
  );
});
test("the repair migration is safe to reapply without replacing messages or memberships", async () => {
  await submitChatMessageBatch(client(), [payload(60)]);
  const requestId = id(100),
    group = await rpc(owner, "create_group_conversation", [
      owner,
      "Existing group",
      [member],
      requestId,
    ]);
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261106190000_messaging_groups_and_polls.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261107140000_messaging_delivery_repair.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal((await db.query("SELECT * FROM messages")).rows.length, 1);
  assert.equal(
    (await db.query("SELECT * FROM conversation_members")).rows.length,
    4,
  );
  assert.equal(
    await rpc(owner, "create_group_conversation", [
      owner,
      "Existing group",
      [member],
      requestId,
    ]),
    group,
  );
});
