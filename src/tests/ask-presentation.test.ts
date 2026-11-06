import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatAskCount,
  formatAskNumber,
  isAskSummaryReady,
  askCategory,
  anonymousTextColor,
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
