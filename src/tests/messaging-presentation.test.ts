import assert from "node:assert/strict";
import { test } from "node:test";
import {
  messageCount,
  formatMessageBadge,
  messageDate,
  categorizeChatContent,
} from "../lib/messagingPresentation.ts";
import { chatPollCounts } from "../lib/chatPoll.ts";
import {
  countUnreadMessages,
  reconcileUnreadCount,
} from "../lib/chatUnread.ts";
import { getMessageStatus, isActiveMute } from "../lib/messageStatus.ts";
import { authReturnPath } from "../lib/authReturnPath.ts";
test("counts preserve zero, singular, multiple and unknown while badges cap presentation only", () => {
  assert.equal(messageCount(0, "member"), "0 members");
  assert.equal(messageCount(1, "member"), "1 member");
  assert.equal(messageCount(2, "member"), "2 members");
  assert.equal(messageCount(undefined, "member"), "— members");
  assert.equal(messageCount(Number.NaN, "member"), "— members");
  assert.equal(formatMessageBadge(1), "1");
  assert.equal(formatMessageBadge(99), "99");
  assert.equal(formatMessageBadge(150), "99+");
  assert.equal(messageDate("invalid"), "");
});
test("unread counts actual incoming rows and arrival sequences rather than sequence gaps or later edits", () => {
  const rows = [
    { sender_id: "other", seq: 9, created_seq: 2 },
    { sender_id: "other", seq: 10, created_seq: 8 },
    { sender_id: "me", seq: 11, created_seq: 11 },
    {
      sender_id: "other",
      seq: 12,
      created_seq: 12,
      deleted_for_everyone: true,
    },
    { sender_id: "other", seq: 15 },
  ];
  assert.equal(countUnreadMessages(rows, "me", 5), 2);
  assert.equal(countUnreadMessages(rows, "me", 15), 0);
  assert.equal(countUnreadMessages(rows, "me", 0), 3);
  assert.equal(reconcileUnreadCount(0, 4, 8, 2, true), 0);
  assert.equal(reconcileUnreadCount(1, 4, 8, 8, false), 4);
});
test("private attachment categories and counts remain stable before signed URLs load; unsafe and deleted content excluded", () => {
  const data = categorizeChatContent([
    { id: "p", message_type: "photo", attachment_url: "chat-media://pending" },
    { id: "f", message_type: "file", attachment_url: "chat-media://file" },
    { id: "a", message_type: "audio", attachment_url: "chat-media://audio" },
    { id: "v", message_type: "voice", attachment_url: "chat-media://voice" },
    { id: "t", content: "https://example.com/test javascript:alert(1)" },
    {
      id: "d",
      message_type: "photo",
      attachment_url: "chat-media://deleted",
      deleted_for_everyone: true,
    },
  ]);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(data).map(([key, items]) => [key, items.length]),
    ),
    { media: 1, files: 1, audio: 1, voice: 1, links: 1 },
  );
});
test("poll metadata distinguishes unknown, known zero, aggregate votes and legacy votes", () => {
  assert.equal(chatPollCounts({}, "me").known, false);
  const zero = chatPollCounts(
    { total_vote_count: 0, option_vote_counts: { a: 0 } },
    "me",
  );
  assert.equal(zero.total, 0);
  assert.equal(zero.percentage("a"), 0);
  const aggregate = chatPollCounts(
    {
      total_vote_count: 3,
      option_vote_counts: { a: 2, b: 1 },
      user_option_ids: ["a"],
    },
    "me",
  );
  assert.equal(aggregate.percentage("a"), 67);
  assert.deepEqual(aggregate.selected, ["a"]);
  const legacy = chatPollCounts(
    { options: [{ id: "a" }], poll_votes: [{ user_id: "me", option_id: "a" }] },
    "me",
  );
  assert.equal(legacy.total, 1);
  assert.equal(legacy.counts.a, 1);
});
test("delivery never claims recipient delivery from server acceptance, and mute expiry respects timezone", () => {
  assert.equal(getMessageStatus("pending", 1, 10), "pending");
  assert.equal(getMessageStatus("sending", 1, 10), "sending");
  assert.equal(getMessageStatus("failed", 1, 10), "failed");
  assert.equal(getMessageStatus("delivered", 9, 8), "sent");
  assert.equal(getMessageStatus("sent", 9, 9), "read");
  const now = Date.parse("2026-11-07T10:00:00+03:00");
  assert.equal(
    isActiveMute({ muted_until: "2026-11-07T07:00:00Z" }, now),
    false,
  );
  assert.equal(
    isActiveMute({ muted_until: "2026-11-07T10:00:01+03:00" }, now),
    true,
  );
  assert.equal(isActiveMute({ muted_until: null }, now), true);
  assert.equal(isActiveMute(undefined, now), false);
});
test("login restores valid chat invitations and selected messages without accepting external redirects", () => {
  for (const path of [
    "/messages",
    "/messages/10000000-0000-4000-8000-000000000001",
    "/messages?invite=20000000-0000-4000-8000-000000000001",
    "/messages/10000000-0000-4000-8000-000000000001?messageId=20000000-0000-4000-8000-000000000001",
  ])
    assert.equal(authReturnPath("?returnTo=" + encodeURIComponent(path)), path);
  for (const path of [
    "//example.com",
    "https://example.com",
    "/messages?invite=bad",
    "/messages?invite=x&returnTo=https://example.com",
  ])
    assert.equal(authReturnPath("?returnTo=" + encodeURIComponent(path)), "/");
});
