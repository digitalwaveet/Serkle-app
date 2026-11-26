import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatAskCount,
  formatAskNumber,
  isAskSummaryReady,
  askCategory,
  anonymousTextColor,
  resolveAskActivityIdentity,
} from "../lib/askPresentation.ts";
test("Ask count labels handle zero, one and multiple counts without changing values", () => {
  for (const [unit, singular, plural] of [
    ["answer", "answer", "answers"],
    ["question", "question", "questions"],
    ["upvote", "upvote", "upvotes"],
    ["update", "story update", "story updates"],
    ["expertAnswer", "expert reply", "expert replies"],
    ["follower", "follower", "followers"],
  ] as const) {
    assert.equal(formatAskCount(0, unit, "en"), "0 " + plural);
    assert.equal(formatAskCount(1, unit, "en"), "1 " + singular);
    assert.equal(formatAskCount(2, unit, "en"), "2 " + plural);
  }
  assert.equal(formatAskCount(1234, "answer", "en-US"), "1,234 answers");
});
test("unknown counts remain unknown while a known zero is retained", () => {
  assert.equal(formatAskNumber(null), "—");
  assert.equal(formatAskNumber(undefined), "—");
  assert.equal(formatAskNumber(NaN), "—");
  assert.equal(formatAskNumber(0), "0");
  assert.equal(formatAskNumber(1234, "de-DE"), "1.234");
});
test("AI readiness requires a ready status and actual summary content", () => {
  for (const value of [
    undefined,
    null,
    {},
    "text",
    { status: "pending" },
    { status: "generating", summary_overview: "text" },
    { status: "failed", summary_overview: "text" },
    { status: "ready" },
    { status: "ready", summary_overview: "  " },
    { status: "ready", most_suggest: [] },
  ])
    assert.equal(isAskSummaryReady(value), false);
  assert.equal(
    isAskSummaryReady({
      status: "ready",
      summary_overview: "A real discussion summary.",
    }),
    true,
  );
  assert.equal(
    isAskSummaryReady({ status: "ready", most_suggest: ["One perspective."] }),
    true,
  );
});
test("category presentation preserves existing category keys", () => {
  assert.equal(askCategory("mental-health"), "Mental health");
  assert.equal(askCategory("career"), "Career");
  assert.equal(askCategory("custom-topic"), "custom-topic");
});
test("anonymous initials remain readable without changing identity colors", () => {
  assert.equal(anonymousTextColor("#713A20"), "#ffffff");
  assert.equal(anonymousTextColor("#FFE2BE"), "#111111");
});
test("Ask activity identity displays given anonymous name unless user is a verified expert", () => {
  const withGiven = resolveAskActivityIdentity({
    userId: "user-1",
    realName: "Actual Account Name",
    username: "actual.account",
    isExpert: false,
    questions: [
      { is_anonymous: false, anonymous_name: null },
      { is_anonymous: true, anonymous_name: "River Finch" },
    ],
  });
  assert.deepEqual(withGiven, {
    isExpertIdentity: false,
    displayName: "River Finch",
    subtitle: "Anonymous identity",
    pseudonym: "River Finch",
  });

  const withoutQuestionsA = resolveAskActivityIdentity({
    userId: "user-2",
    realName: "Actual Account Name",
    username: "actual.account",
    isExpert: false,
    questions: [],
  });
  const withoutQuestionsB = resolveAskActivityIdentity({
    userId: "user-2",
    realName: "Actual Account Name",
    username: "actual.account",
    isExpert: false,
    questions: [],
  });
  assert.equal(withoutQuestionsA.isExpertIdentity, false);
  assert.equal(withoutQuestionsA.displayName, withoutQuestionsB.displayName);
  assert.notEqual(withoutQuestionsA.displayName, "Actual Account Name");
  assert.equal(withoutQuestionsA.subtitle, "Anonymous identity");

  const expertIdentity = resolveAskActivityIdentity({
    userId: "user-3",
    realName: "Dr. Hana Tesfaye",
    username: "hana",
    isExpert: true,
    questions: [{ is_anonymous: true, anonymous_name: "River Finch" }],
  });
  assert.deepEqual(expertIdentity, {
    isExpertIdentity: true,
    displayName: "Dr. Hana Tesfaye",
    subtitle: "@hana",
  });
});
