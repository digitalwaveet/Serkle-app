import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationPanelEntries } from "../lib/notificationPanelEntries.ts";
import { getTimeGroup } from "../utils/notificationHelpers.ts";
const now = new Date().toISOString();
const row = (id: string, read = false) => ({
  id,
  notification_type: "like",
  title: "Like",
  body: "A reaction",
  read_at: read ? now : null,
  sent_at: now,
  created_at: now,
  data: { userId: id, postId: "post" },
});
test("batched updates retain title, time group and every underlying ID", () => {
  const source = [row("hana", true), row("dawit")];
  const [entry] = notificationPanelEntries(source, "all", [
    { id: "hana", name: "Hana" },
    { id: "dawit", name: "Dawit" },
  ]);
  assert.equal(entry.title, "Hana and Dawit liked your post");
  assert.deepEqual(entry.ids, ["hana", "dawit"]);
  assert.deepEqual(entry.unreadIds, ["dawit"]);
  assert.equal(entry.group, getTimeGroup(now));
  assert.equal(entry.count, 2);
  assert.equal(entry.notification.id, "hana");
  assert.equal(source[1].read_at, null);
});
test("unavailable sender profiles use an accurate title without undefined names", () => {
  const [entry] = notificationPanelEntries(
    [row("a"), row("b"), row("c")],
    "all",
  );
  assert.equal(entry.title, "3 people liked your post");
  assert.equal(entry.count, 3);
  assert.deepEqual(entry.unreadIds, ["a", "b", "c"]);
});
test("partial profile results account for every other person", () => {
  const source = [row("a"), row("b"), row("c"), row("d")];
  assert.equal(
    notificationPanelEntries(source, "all", [{ id: "a", name: "Hana" }])[0]
      .title,
    "Hana and 3 others liked your post",
  );
  assert.equal(
    notificationPanelEntries(source, "all", [
      { id: "a", name: "Hana" },
      { id: "b", name: "Dawit" },
    ])[0].title,
    "Hana, Dawit and 2 others liked your post",
  );
});
test("unread filters include only unread records without changing source counts", () => {
  const source = [row("a", true), row("b")];
  const [entry] = notificationPanelEntries(source, "unread");
  assert.deepEqual(entry.ids, ["b"]);
  assert.deepEqual(entry.unreadIds, ["b"]);
  assert.equal(source.length, 2);
  assert.equal(source.filter((row) => !row.read_at).length, 1);
  assert.deepEqual(notificationPanelEntries(source, "shop"), []);
});
test("message groups resolve sender IDs and mark only their unread records", () => {
  const source = [
    {
      ...row("a", true),
      notification_type: "new_message",
      data: { senderId: "hana", conversationId: "chat" },
    },
    {
      ...row("b"),
      notification_type: "new_message",
      data: { senderId: "hana", conversationId: "chat" },
    },
  ];
  const [entry] = notificationPanelEntries(source, "messages", [
    { id: "hana", name: "Hana" },
  ]);
  assert.deepEqual(entry.ids, ["a", "b"]);
  assert.deepEqual(entry.unreadIds, ["b"]);
  assert.equal(entry.profiles[0].id, "hana");
  assert.equal(entry.body, "Sent you 2 new messages");
});
