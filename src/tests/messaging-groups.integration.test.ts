import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
const db = new PGlite();
const id = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  member = id(2),
  admin = id(3),
  outsider = id(4),
  extra = id(5);
let group: string;
const query = async <T = any>(sql: string, args: unknown[] = []) =>
  (await db.query<T>(sql, args)).rows;
async function as(user: string | null, role = "authenticated") {
  await db.exec("RESET ROLE");
  await query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
    user || "",
  ]);
  await db.exec(`SET ROLE ${role}`);
}
const rpc = async <T = any>(name: string, args: unknown[] = []) =>
  (
    await query<{ value: T }>(
      `SELECT public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
      args,
    )
  )[0]?.value;
before(async () => {
  await db.exec(
    await readFile(
      new URL("./fixtures/messaging.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261106190000_messaging_groups_and_polls.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
after(() => db.close());
beforeEach(async () => {
  await db.exec(
    "RESET ROLE;TRUNCATE profiles,conversations,conversation_members,messages,group_admins,group_mutes,group_polls,poll_votes,chat_group_requests,chat_group_invites CASCADE",
  );
  await query(
    "INSERT INTO profiles(id,name,username,initials) SELECT x,'Member '||x,'user','ME' FROM unnest($1::uuid[]) x",
    [[owner, member, admin, outsider, extra]],
  );
  await as(owner);
  group = await rpc<string>("create_group_conversation", [
    owner,
    "Creative Collective",
    [member, admin],
    id(100),
  ]);
});
test("creation authenticates the creator, deduplicates members and reuses the request ID", async () => {
  assert.equal(
    await rpc("create_group_conversation", [
      owner,
      "Creative Collective",
      [member, member, owner, admin],
      id(100),
    ]),
    group,
  );
  assert.equal(
    (
      await query(
        "SELECT count(*)::int n FROM conversation_members WHERE conversation_id=$1",
        [group],
      )
    )[0].n,
    3,
  );
  await as(outsider);
  await assert.rejects(
    () =>
      rpc("create_group_conversation", [owner, "Spoofed", [outsider], id(101)]),
    /Not authorized/,
  );
});
test("repeated create requests produce one group and preserve ownership", async () => {
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      rpc("create_group_conversation", [
        owner,
        "Same request",
        [member],
        id(102),
      ]),
    ),
  );
  assert.equal(new Set(results).size, 1);
  assert.equal(
    (
      await query(
        "SELECT count(*)::int n FROM conversations WHERE created_by=$1",
        [owner],
      )
    )[0].n,
    2,
  );
});
test("outsiders cannot insert themselves through an old permissive membership policy", async () => {
  await as(outsider);
  assert.equal(
    (await query("SELECT * FROM conversations WHERE id=$1", [group])).length,
    0,
  );
  await assert.rejects(
    () =>
      query(
        "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)",
        [group, outsider],
      ),
    /row-level security/,
  );
});
test("member cannot add/remove someone else, change details, or promote themselves", async () => {
  await as(member);
  await assert.rejects(
    () => rpc("add_chat_group_members", [group, [extra]]),
    /Admin permission/,
  );
  await assert.rejects(
    () => rpc("remove_group_member", [group, admin]),
    /Not authorized/,
  );
  await assert.rejects(
    () => rpc("set_chat_group_admin", [group, member, true]),
    /Admin permission/,
  );
  await assert.rejects(
    () => rpc("update_chat_group", [group, "Hijacked"]),
    /Admin permission/,
  );
  await assert.rejects(
    () =>
      query("UPDATE conversations SET group_name=$1 WHERE id=$2", [
        "Hijacked",
        group,
      ]),
    /Admin permission/,
  );
});
test("admin changes are checked server-side and repeated member adds do not duplicate", async () => {
  await rpc("set_chat_group_admin", [group, admin, true]);
  await as(admin);
  assert.equal(
    await rpc("add_chat_group_members", [group, [extra, extra, member]]),
    1,
  );
  assert.equal(await rpc("add_chat_group_members", [group, [extra]]), 0);
  await rpc("update_chat_group", [group, "Updated"]);
  assert.equal(
    (
      await query("SELECT group_name FROM conversations WHERE id=$1", [group])
    )[0].group_name,
    "Updated",
  );
  await assert.rejects(
    () => rpc("remove_group_member", [group, owner]),
    /Transfer ownership/,
  );
});
test("ordinary members cannot delete admin rows even with a permissive old policy", async () => {
  await rpc("set_chat_group_admin", [group, admin, true]);
  await db.exec(
    "RESET ROLE;CREATE POLICY legacy_admin_delete ON group_admins FOR DELETE TO authenticated USING(true)",
  );
  await as(member);
  await query(
    "DELETE FROM group_admins WHERE conversation_id=$1 AND user_id=$2",
    [group, admin],
  );
  assert.equal(
    (
      await query(
        "SELECT * FROM group_admins WHERE conversation_id=$1 AND user_id=$2",
        [group, admin],
      )
    ).length,
    1,
  );
  await db.exec("RESET ROLE;DROP POLICY legacy_admin_delete ON group_admins");
});
test("owner must explicitly transfer; old owner remains an admin and can then leave", async () => {
  await assert.rejects(
    () => rpc("remove_group_member", [group, owner]),
    /Transfer ownership/,
  );
  await assert.rejects(
    () =>
      query("UPDATE conversations SET created_by=$1 WHERE id=$2", [
        member,
        group,
      ]),
    /Protected group fields/,
  );
  await rpc("transfer_chat_group_ownership", [group, member]);
  assert.equal(
    (
      await query("SELECT created_by FROM conversations WHERE id=$1", [group])
    )[0].created_by,
    member,
  );
  assert.equal(await rpc("chat_group_admin", [group]), true);
  await rpc("remove_group_member", [group, owner]);
  assert.equal(await rpc("chat_group_member", [group]), false);
  await as(member);
  assert.equal(await rpc("chat_group_admin", [group]), true);
});
test("eligible member can leave and immediately loses group API access", async () => {
  await as(member);
  await rpc("remove_group_member", [group, member]);
  assert.equal(await rpc("chat_group_member", [group]), false);
  await assert.rejects(
    () => rpc("get_chat_group_polls", [group]),
    /Group membership/,
  );
  await as(owner);
  assert.equal(
    (
      await query(
        "SELECT count(*)::int n FROM conversation_members WHERE conversation_id=$1",
        [group],
      )
    )[0].n,
    2,
  );
});
test("legacy direct self-leave removes admin privileges and revokes issued invitations", async () => {
  await rpc("set_chat_group_admin", [group, admin, true]);
  await as(admin);
  const invite = await rpc<any>("create_chat_group_invite", [group]);
  await query(
    "DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2",
    [group, admin],
  );
  await as(owner);
  await assert.rejects(
    () => rpc("get_chat_group_invite", [invite.token]),
    /expired/,
  );
  await rpc("add_chat_group_members", [group, [admin]]);
  await as(admin);
  assert.equal(await rpc("chat_group_admin", [group]), false);
});
test("demoting an administrator revokes their invitation while preserving membership", async () => {
  await rpc("set_chat_group_admin", [group, admin, true]);
  await as(admin);
  const invite = await rpc<any>("create_chat_group_invite", [group]);
  await as(owner);
  await rpc("set_chat_group_admin", [group, admin, false]);
  await as(outsider);
  await assert.rejects(() => rpc("join_chat_group", [invite.token]), /expired/);
  await as(admin);
  assert.equal(await rpc("chat_group_member", [group]), true);
  assert.equal(await rpc("chat_group_admin", [group]), false);
});
test("invite creation is admin-only, links expire and joins are idempotent", async () => {
  await as(member);
  await assert.rejects(
    () => rpc("create_chat_group_invite", [group]),
    /Admin permission/,
  );
  await as(owner);
  const invite = await rpc<{ token: string; expires_at: string }>(
    "create_chat_group_invite",
    [group],
  );
  assert.equal(
    (await rpc<any>("create_chat_group_invite", [group])).token,
    invite.token,
  );
  await as(outsider);
  assert.equal(
    (await rpc<any>("get_chat_group_invite", [invite.token])).name,
    "Creative Collective",
  );
  await Promise.all(
    Array.from({ length: 4 }, () => rpc("join_chat_group", [invite.token])),
  );
  await as(owner);
  assert.equal(
    (
      await query(
        "SELECT count(*)::int n FROM conversation_members WHERE conversation_id=$1 AND user_id=$2",
        [group, outsider],
      )
    )[0].n,
    1,
  );
  await db.exec("RESET ROLE");
  await query(
    "UPDATE chat_group_invites SET expires_at=now()-interval '1 second' WHERE token=$1",
    [invite.token],
  );
  await as(extra);
  await assert.rejects(() => rpc("join_chat_group", [invite.token]), /expired/);
});
test("revoked and unknown invitations do not grant membership", async () => {
  const invite = await rpc<any>("create_chat_group_invite", [group]);
  await rpc("revoke_chat_group_invite", [invite.token]);
  await as(outsider);
  await assert.rejects(() => rpc("join_chat_group", [invite.token]), /expired/);
  await assert.rejects(() => rpc("join_chat_group", [id(999)]), /expired/);
});
test("anonymous requests cannot create groups, inspect invites or vote", async () => {
  await as(null, "anon");
  await assert.rejects(
    () => rpc("create_group_conversation", [owner, "No", [member], id(103)]),
    /permission denied/,
  );
  await assert.rejects(
    () => rpc("get_chat_group_invite", [id(999)]),
    /permission denied/,
  );
  await assert.rejects(
    () => rpc("set_chat_poll_vote", [id(999), "opt_0", true]),
    /permission denied/,
  );
});
const createPoll = (anonymous = false, multiple = false) =>
  rpc<string>("create_chat_group_poll", [
    group,
    "Which time?",
    ["Morning", "Afternoon"],
    anonymous,
    multiple,
    id(200),
  ]);
test("poll creation and its chat message are atomic and idempotent", async () => {
  const poll = await createPoll();
  assert.equal(await createPoll(), poll);
  assert.equal(
    (
      await query("SELECT count(*)::int n FROM group_polls WHERE id=$1", [poll])
    )[0].n,
    1,
  );
  assert.equal(
    (
      await query(
        "SELECT count(*)::int n FROM messages WHERE conversation_id=$1 AND attachment_url=$2",
        [group, poll],
      )
    )[0].n,
    1,
  );
  await assert.rejects(
    () =>
      rpc("create_chat_group_poll", [
        group,
        "Invalid",
        ["One"],
        false,
        false,
        id(201),
      ]),
    /Invalid poll/,
  );
});
test("single-choice votes switch atomically; retries and unvotes preserve accurate totals", async () => {
  const poll = await createPoll();
  await as(member);
  await rpc("set_chat_poll_vote", [poll, "opt_0", true]);
  await rpc("set_chat_poll_vote", [poll, "opt_0", true]);
  let result = await rpc<any>("get_chat_group_poll", [poll]);
  assert.equal(result.total_vote_count, 1);
  assert.equal(Number(result.option_vote_counts.opt_0), 1);
  await rpc("set_chat_poll_vote", [poll, "opt_1", true]);
  result = await rpc<any>("get_chat_group_poll", [poll]);
  assert.equal(result.total_vote_count, 1);
  assert.deepEqual(result.user_option_ids, ["opt_1"]);
  await rpc("set_chat_poll_vote", [poll, "opt_1", false]);
  assert.equal(
    (await rpc<any>("get_chat_group_poll", [poll])).total_vote_count,
    0,
  );
});
test("multiple-choice totals count actual votes and invalid options are rejected", async () => {
  const poll = await createPoll(false, true);
  await as(member);
  await rpc("set_chat_poll_vote", [poll, "opt_0", true]);
  await rpc("set_chat_poll_vote", [poll, "opt_1", true]);
  assert.equal(
    (await rpc<any>("get_chat_group_poll", [poll])).total_vote_count,
    2,
  );
  await assert.rejects(
    () => rpc("set_chat_poll_vote", [poll, "opt_bad", true]),
    /Invalid option/,
  );
});
test("anonymous poll totals are complete without exposing another voter identity", async () => {
  const poll = await createPoll(true);
  await as(member);
  await rpc("set_chat_poll_vote", [poll, "opt_0", true]);
  await as(admin);
  await rpc("set_chat_poll_vote", [poll, "opt_1", true]);
  const result = await rpc<any>("get_chat_group_poll", [poll]);
  assert.equal(result.total_vote_count, 2);
  assert.equal(JSON.stringify(result).includes(member), false);
  assert.deepEqual(result.user_option_ids, ["opt_1"]);
  await as(owner);
  await assert.rejects(
    () => rpc("get_chat_poll_voters", [poll]),
    /Voter details unavailable/,
  );
  assert.equal(
    (await query("SELECT * FROM poll_votes WHERE poll_id=$1", [poll])).length,
    0,
  );
});
test("only the creator can end a poll or inspect non-anonymous voter details", async () => {
  const poll = await createPoll();
  await as(member);
  await rpc("set_chat_poll_vote", [poll, "opt_0", true]);
  await assert.rejects(
    () => rpc("end_chat_group_poll", [poll]),
    /creator permission/,
  );
  await assert.rejects(
    () => rpc("get_chat_poll_voters", [poll]),
    /Voter details unavailable/,
  );
  await as(owner);
  assert.equal((await rpc<any[]>("get_chat_poll_voters", [poll])).length, 1);
  await rpc("end_chat_group_poll", [poll]);
  await as(member);
  await assert.rejects(
    () => rpc("set_chat_poll_vote", [poll, "opt_1", true]),
    /ended/,
  );
});
test("mute settings are private, persist, and cannot be written for another member", async () => {
  await as(member);
  await query(
    "INSERT INTO group_mutes(conversation_id,user_id,muted_until) VALUES($1,$2,NULL)",
    [group, member],
  );
  assert.equal(
    (await query("SELECT * FROM group_mutes WHERE conversation_id=$1", [group]))
      .length,
    1,
  );
  await assert.rejects(
    () =>
      query("INSERT INTO group_mutes(conversation_id,user_id) VALUES($1,$2)", [
        group,
        admin,
      ]),
    /row-level security/,
  );
  await as(owner);
  assert.equal(
    (await query("SELECT * FROM group_mutes WHERE conversation_id=$1", [group]))
      .length,
    0,
  );
});
test("group avatar storage permits admins and rejects members and cross-group paths", async () => {
  await as(member);
  await assert.rejects(
    () =>
      query("INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)", [
        "group-avatars",
        `${group}/avatar.jpg`,
      ]),
    /row-level security/,
  );
  await as(owner);
  await query("INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)", [
    "group-avatars",
    `${group}/avatar.jpg`,
  ]);
  await assert.rejects(
    () =>
      query("INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)", [
        "group-avatars",
        `${id(999)}/avatar.jpg`,
      ]),
    /row-level security/,
  );
});
