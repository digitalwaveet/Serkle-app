import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { chromium, expect, type Browser, type Page } from "@playwright/test";
import type { ViteDevServer } from "vite";
import { startAskServer } from "./fixtures/ask-server.ts";
let browser: Browser, server: ViteDevServer, base: string;
const browserErrors: string[] = [];
before(async () => {
  server = await startAskServer();
  const address = server.httpServer!.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : ""}`;
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-proxy-server"],
  });
});
after(async () => {
  await browser?.close();
  await server?.close();
  assert.deepEqual(browserErrors, [], "Ask fixture browser errors");
});
async function askPage(
  scenario = "",
  path = "/ask",
  viewport = { width: 390, height: 844 },
) {
  const context = await browser.newContext({
    viewport,
    timezoneId: "Africa/Nairobi",
  });
  context.setDefaultTimeout(12000);
  await context.route("**/*", (route) =>
    route
      .request()
      .url()
      .startsWith(base + "/")
      ? route.continue()
      : route.abort(),
  );
  await context.addInitScript((scenario) => {
    localStorage.setItem("ask-scenario", scenario);
    localStorage.setItem("theme", "light");
  }, scenario);
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
    process.stderr.write(`Ask fixture: ${error.message}\n`);
  });
  await page.goto(base + path, { timeout: 60000 });
  return page;
}
const calls = (page: Page) =>
  page.evaluate(
    () =>
      (window as any).askFixture.calls as Array<{ name: string; value: any }>,
  );
async function composer(page: Page) {
  await page
    .getByRole("button", { name: "Ask a question", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Let’s talk about it",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function fillQuestion(page: Page) {
  const dialog = await composer(page);
  await dialog
    .getByRole("textbox", { name: "What would you like to ask?", exact: true })
    .fill("How do you make time for creative work?");
  await dialog.getByRole("button", { name: "Career", exact: true }).click();
  return dialog;
}

test("feed matches the concept, preserves real counts and keeps global navbar sizing", async () => {
  const page = await askPage();
  try {
    await expect(
      page.getByRole("heading", { name: /What’s on/ }),
    ).toBeVisible();
    await expect(page.locator(".ask-question-card")).toHaveCount(4);
    const first = page.getByTestId("ask-question-q1");
    await expect(first).toContainText("2 answers");
    await expect(first).toContainText("1 expert reply");
    await expect(first).toContainText("2 story updates");
    await expect(first).not.toContainText("AI summary available");
    await expect(page.getByTestId("ask-question-q3")).toContainText(
      "Story thread",
    );
    await expect(page.getByTestId("ask-question-q3")).not.toContainText(
      "2 story updates",
    );
    assert.equal(
      await page
        .getByTestId("nav-ask")
        .evaluate((element) => element.closest(".ask-ui") === null),
      true,
    );
    assert.equal(
      await page
        .getByTestId("nav-ask")
        .evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).height),
        ),
      40,
    );
    assert.deepEqual(await calls(page), []);
  } finally {
    await page.context().close();
  }
});
test("topics, sorting, expert authors and search keep their existing query meaning", async () => {
  const page = await askPage();
  try {
    await page
      .getByRole("group", { name: "Question topics" })
      .getByRole("button", { name: "Career", exact: true })
      .click();
    await expect(page.getByTestId("ask-question-q1")).toBeVisible();
    await expect(page.getByTestId("ask-question-q2")).toHaveCount(0);
    await page
      .getByRole("group", { name: "Question topics" })
      .getByRole("button", { name: "All", exact: true })
      .click();
    await page
      .getByRole("button", { name: "From experts", exact: true })
      .click();
    await expect(page.getByTestId("ask-question-q2")).toBeVisible();
    await expect(page.getByTestId("ask-question-q1")).toHaveCount(0);
    await page.getByRole("button", { name: "Unanswered", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "From experts", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("ask-question-q3")).toBeVisible();
    await page.getByRole("button", { name: "Recent", exact: true }).click();
    await page
      .getByRole("searchbox", { name: "Search questions and topics" })
      .fill("friends");
    await expect(page.getByTestId("ask-question-q3")).toBeVisible();
    await expect(page.getByTestId("ask-question-q1")).toHaveCount(0);
    assert.equal(
      await page.evaluate(
        () => (window as any).askFixture.queries.at(-1).search,
      ),
      "friends",
    );
  } finally {
    await page.context().close();
  }
});
test("question cards are keyboard accessible and votes wait for success", async () => {
  const page = await askPage("pending-question-vote");
  try {
    const card = page.getByTestId("ask-question-q1");
    const vote = card.getByRole("button", { name: "Helpful 2", exact: true });
    await vote.dblclick({ force: true });
    await expect(vote).toBeDisabled();
    assert.equal(
      (await calls(page)).filter((call) => call.name === "question-vote")
        .length,
      1,
    );
    await expect(vote).toHaveAttribute("aria-pressed", "true");
    const title = card.getByRole("button", {
      name: "How do you switch off after a busy workday?",
      exact: true,
    });
    await title.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("ask-current-path")).toHaveText(
      "/ask/question/q1",
    );
  } finally {
    await page.context().close();
  }
});
test("failed votes keep the original count and show an error", async () => {
  const page = await askPage("question-vote-error");
  try {
    const card = page.getByTestId("ask-question-q1");
    await card.getByRole("button", { name: "Helpful 2", exact: true }).click();
    await expect(card.getByRole("alert")).toContainText("could not be saved");
    await expect(
      card.getByRole("button", { name: "Helpful 2", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  } finally {
    await page.context().close();
  }
});
test("composer previews the actual pseudonym and prevents repeated pending submissions", async () => {
  const page = await askPage("pending-create-question");
  try {
    const dialog = await fillQuestion(page);
    const identity = await dialog
      .locator(".ask-public-identity strong")
      .innerText();
    assert.ok(identity.startsWith("Anonymous · "));
    await dialog
      .getByRole("button", { name: "Publish question", exact: true })
      .dblclick({ force: true });
    await expect(
      dialog.getByRole("button", { name: "Close dialog", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    assert.equal(
      (await calls(page)).filter((call) => call.name === "create-question")
        .length,
      1,
    );
    await expect(dialog).toHaveCount(0);
    const request = (await calls(page)).find(
      (call) => call.name === "create-question",
    )!;
    assert.equal(request.value.isAnonymous, true);
    assert.equal(
      request.value.anonymousName,
      identity.split("Anonymous · ")[1],
    );
    assert.equal(
      request.value.question,
      "How do you make time for creative work?",
    );
    assert.equal(request.value.category, "career");
    assert.equal(request.value.isThread, false);
  } finally {
    await page.context().close();
  }
});
test("public-profile and verified-expert posting show the correct identity and payload", async () => {
  for (const scenario of ["", "expert"]) {
    const page = await askPage(scenario);
    try {
      const dialog = await fillQuestion(page);
      if (scenario) {
        await expect(dialog.getByRole("radio")).toHaveCount(0);
        await expect(dialog.locator(".ask-public-identity")).toContainText(
          "Verified expert · Actual Account Name",
        );
      } else {
        await dialog
          .getByRole("radio", { name: "Post with my profile", exact: true })
          .check();
        await expect(dialog.locator(".ask-public-identity")).toContainText(
          "Profile · Actual Account Name",
        );
      }
      await dialog
        .getByRole("button", { name: "Publish question", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      const request = (await calls(page)).find(
        (call) => call.name === "create-question",
      )!;
      assert.equal(request.value.isAnonymous, false);
      assert.equal(request.value.anonymousName, undefined);
    } finally {
      await page.context().close();
    }
  }
});
test("failed publishing retains the draft and re-enables retry", async () => {
  const page = await askPage("create-question-error");
  try {
    const dialog = await fillQuestion(page);
    await dialog
      .getByRole("button", { name: "Publish question", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Your text is still here",
    );
    await expect(
      dialog.getByRole("textbox", {
        name: "What would you like to ask?",
        exact: true,
      }),
    ).toHaveValue("How do you make time for creative work?");
    await expect(
      dialog.getByRole("button", { name: "Publish question", exact: true }),
    ).toBeEnabled();
  } finally {
    await page.context().close();
  }
});
test("unknown or failed posting identity cannot publish", async () => {
  for (const scenario of ["identity-loading", "identity-error", "auth-error"]) {
    const page = await askPage(scenario);
    try {
      const dialog = await fillQuestion(page);
      await expect(
        dialog.getByRole("button", { name: "Publish question", exact: true }),
      ).toBeDisabled();
      assert.equal(
        (await calls(page)).filter((call) => call.name === "create-question")
          .length,
        0,
      );
      if (scenario !== "identity-loading")
        await expect(
          dialog.getByRole("button", {
            name: "Retry identity check",
            exact: true,
          }),
        ).toBeVisible();
    } finally {
      await page.context().close();
    }
  }
});
test("story composer persists through the existing question API as a real thread", async () => {
  const page = await askPage("", "/ask/components");
  try {
    await page
      .getByRole("button", { name: "Open story composer", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Share your story",
      exact: true,
    });
    await dialog
      .getByRole("textbox", { name: "Your story", exact: true })
      .fill("I made a little space for creative work this week.");
    await dialog
      .getByRole("button", { name: "Publish story", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const request = (await calls(page)).find(
      (call) => call.name === "create-question",
    )!;
    assert.equal(request.value.isThread, true);
    assert.equal(request.value.category, "other");
    assert.equal(request.value.isAnonymous, true);
  } finally {
    await page.context().close();
  }
});
test("stored anonymous expert questions do not expose a legacy public profile", async () => {
  const page = await askPage("legacy-anon-expert");
  try {
    const card = page.getByTestId("ask-question-q1");
    await expect(card).toContainText("Quiet Cedar");
    await expect(card).not.toContainText("Private expert author");
    await expect(
      card.getByRole("button", { name: "Private expert author", exact: true }),
    ).toHaveCount(0);
  } finally {
    await page.context().close();
  }
});
test("expert directory and nested profile preserve focus and show neutral unknown presence", async () => {
  const page = await askPage();
  try {
    await page.getByRole("button", { name: "View all", exact: true }).click();
    const directory = page.getByRole("dialog", {
      name: "Verified community experts",
      exact: true,
    });
    await directory.getByRole("button", { name: /View Hana Tesfaye/ }).click();
    const profile = page.getByRole("dialog", {
      name: "Expert profile",
      exact: true,
    });
    await expect(
      profile.getByText("Presence unavailable", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(profile).toHaveCount(0);
    await expect(directory).toBeVisible();
    await expect(
      directory.getByRole("button", { name: /View Hana Tesfaye/ }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(directory).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "View all", exact: true }),
    ).toBeFocused();
  } finally {
    await page.context().close();
  }
});
test("expert verification keeps its wizard, accessible fields and focus inside Ask", async () => {
  const page = await askPage("", "/ask/profile", { width: 320, height: 568 });
  try {
    const trigger = page.getByRole("button", {
      name: "Apply for expert verification",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Expert Verification",
      exact: true,
    });
    await dialog
      .getByRole("button", { name: "Career Professional", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      dialog.getByRole("textbox", { name: "Full legal name", exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole("textbox", { name: "Public display name", exact: true })
      .fill("Public expert name");
    assert.equal(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    assert.deepEqual(await calls(page), []);
  } finally {
    await page.context().close();
  }
});

test("featured answers navigate to question IDs and expert messaging keeps its existing action", async () => {
  const page = await askPage();
  try {
    await page
      .getByRole("button", { name: "View answer", exact: true })
      .click();
    await expect(page.getByTestId("ask-current-path")).toHaveText(
      "/ask/question/q1",
    );
  } finally {
    await page.context().close();
  }
  const second = await askPage("historical");
  try {
    await second.getByRole("button", { name: /View Hana Tesfaye/ }).click();
    const profile = second.getByRole("dialog", {
      name: "Expert profile",
      exact: true,
    });
    await expect(
      profile.getByText("Last seen 18 days ago", { exact: true }),
    ).toBeVisible();
    await expect(profile.getByText("Online now", { exact: true })).toHaveCount(
      0,
    );
    await profile
      .getByRole("button", { name: "DM Expert", exact: true })
      .click();
    await expect(second.getByTestId("ask-current-path")).toHaveText(
      "/messages",
    );
    assert.deepEqual(
      (await calls(second)).find((call) => call.name === "conversation")?.value,
      ["viewer", "expert-1"],
    );
  } finally {
    await second.context().close();
  }
});
test("question detail puts real community replies before AI and preserves bookmarks across navigation", async () => {
  const page = await askPage("", "/ask/question/q1");
  try {
    await expect(page.locator(".ask-detail-answer")).toHaveCount(2);
    assert.equal(
      await page
        .locator(".ask-ai-summary")
        .evaluate(
          (element) =>
            !!(
              element.compareDocumentPosition(
                document.querySelector(".ask-detail-answer")!,
              ) & Node.DOCUMENT_POSITION_PRECEDING
            ),
        ),
      true,
    );
    await page
      .getByRole("button", { name: "Save question", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Unsave question", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page
      .getByRole("button", { name: "My activity", exact: true })
      .click();
    await page.getByRole("button", { name: "Saved", exact: true }).click();
    await expect(page.locator(".ask-activity-row")).toContainText(
      "How do you switch off after a busy workday?",
    );
  } finally {
    await page.context().close();
  }
});
test("replies retain text on failure and prevent repeated sends while pending", async () => {
  for (const scenario of ["create-answer-error", "pending-create-answer"]) {
    const page = await askPage(scenario, "/ask/question/q1");
    try {
      const form = page.getByRole("form", { name: "Write a reply" });
      const input = form.getByRole("textbox", {
        name: "Your reply",
        exact: true,
      });
      await input.fill(
        "A small routine has helped me make room for creativity.",
      );
      await form
        .getByRole("button", { name: "Post reply", exact: true })
        .dblclick({ force: true });
      if (scenario.endsWith("error")) {
        await expect(form.getByRole("alert")).toContainText(
          "Your text is still here",
        );
        await expect(input).toHaveValue(
          "A small routine has helped me make room for creativity.",
        );
      } else {
        await expect(
          form.getByRole("button", { name: "Post reply", exact: true }),
        ).toBeDisabled();
        await expect(input).toHaveValue("");
      }
      assert.equal(
        (await calls(page)).filter((call) => call.name === "create-answer")
          .length,
        1,
      );
    } finally {
      await page.context().close();
    }
  }
});
test("readers cannot edit another author’s question and owner deletion uses confirmation", async () => {
  const reader = await askPage("", "/ask/question/q1");
  try {
    await expect(
      reader.getByRole("button", { name: "Delete question", exact: true }),
    ).toHaveCount(0);
  } finally {
    await reader.context().close();
  }
  for (const scenario of ["owner", "owner-delete-question-error"]) {
    const page = await askPage(scenario, "/ask/question/q1");
    try {
      await page
        .getByRole("button", { name: "Delete question", exact: true })
        .click();
      let dialog = page.getByRole("alertdialog", {
        name: "Delete this question?",
        exact: true,
      });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.equal(
        (await calls(page)).filter((call) => call.name === "delete-question")
          .length,
        0,
      );
      await page
        .getByRole("button", { name: "Delete question", exact: true })
        .click();
      dialog = page.getByRole("alertdialog", {
        name: "Delete this question?",
        exact: true,
      });
      await dialog.getByRole("button", { name: "Delete", exact: true }).click();
      if (scenario.endsWith("error")) {
        await expect(dialog.getByRole("alert")).toContainText(
          "could not be deleted",
        );
        await expect(dialog).toBeVisible();
      } else
        await expect(page.getByTestId("ask-current-path")).toHaveText("/ask");
    } finally {
      await page.context().close();
    }
  }
});
test("anonymous original authors keep their public identity in the reply composer and AI payload", async () => {
  const page = await askPage("anon-owner", "/ask/question/q1");
  try {
    await expect(
      page.getByRole("form", { name: "Write a reply" }),
    ).toContainText("Posting as Anonymous · Quiet Cedar");
    await expect(
      page
        .getByRole("form", { name: "Write a reply" })
        .locator('img[src="/sample/owner.svg"]'),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Generate AI summary", exact: true })
      .click();
    await expect(page.locator(".ask-ai-summary")).toContainText(
      "The discussion shares several personal routines.",
    );
    const request = (await calls(page)).find(
      (call) => call.name === "generate-summary",
    )!;
    assert.equal(
      request.value.answers.find((answer: any) => answer.id === "a2")
        .authorName,
      "Quiet Cedar",
    );
    assert.equal(
      JSON.stringify(request.value).includes("Actual Account Name"),
      false,
    );
  } finally {
    await page.context().close();
  }
});
test("story updates and author-only helpful marking keep their existing mutations", async () => {
  const page = await askPage("owner", "/ask/question/q1");
  try {
    await page.getByRole("button", { name: "Add Update", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Your story update", exact: true })
      .fill("I have made a little more time for myself.");
    await page
      .getByRole("button", { name: "Post Update", exact: true })
      .click();
    await expect(
      page.getByText("I have made a little more time for myself.", {
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(
      (await calls(page)).filter((call) => call.name === "create-update")
        .length,
      1,
    );
    await page
      .getByRole("button", { name: "Mark as helpful", exact: true })
      .first()
      .click();
    await expect(
      page.getByText("Marked as helpful", { exact: false }).first(),
    ).toBeVisible();
    assert.equal(
      (await calls(page)).filter((call) => call.name === "mark-helpful").length,
      1,
    );
  } finally {
    await page.context().close();
  }
});
test("AI badges reflect stored ready metadata and generation failure remains explicit", async () => {
  for (const scenario of ["summary-ready", "summary-pending", ""]) {
    const page = await askPage(scenario);
    try {
      await expect(
        page
          .getByTestId("ask-question-q1")
          .getByText("AI summary available", { exact: true }),
      ).toHaveCount(scenario === "summary-ready" ? 1 : 0);
    } finally {
      await page.context().close();
    }
  }
  const page = await askPage("generate-summary-error", "/ask/question/q1");
  try {
    await page
      .getByRole("button", { name: "Generate AI summary", exact: true })
      .click();
    await expect(
      page.locator(".ask-ai-summary").getByRole("alert"),
    ).toContainText("could not be generated");
    await expect(
      page.getByRole("button", { name: "Generate AI summary", exact: true }),
    ).toBeEnabled();
  } finally {
    await page.context().close();
  }
});
test("activity and feed distinguish loading, failures, empty results and unknown statistics", async () => {
  for (const [scenario, path, label] of [
    ["loading", "/ask", "Loading questions"],
    ["activity-loading", "/ask/profile", "Loading your questions"],
  ]) {
    const page = await askPage(scenario, path);
    try {
      await expect(
        page.getByRole("status", { name: label, exact: true }),
      ).toBeVisible();
    } finally {
      await page.context().close();
    }
  }
  for (const [scenario, path, title] of [
    ["feed-empty-error", "/ask", "Questions couldn’t be loaded"],
    ["empty", "/ask", "No questions here yet"],
    ["activity-error", "/ask/profile", "Your activity couldn’t be loaded"],
    ["answers-error", "/ask/question/q1", "Replies could not be refreshed"],
  ]) {
    const page = await askPage(scenario, path);
    try {
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
    } finally {
      await page.context().close();
    }
  }
  const page = await askPage("statistics-error", "/ask/profile");
  try {
    await expect(page.locator(".ask-profile-stat strong")).toHaveText([
      "—",
      "—",
      "—",
      "—",
    ]);
    await expect(
      page.getByRole("button", { name: "Retry statistics", exact: true }),
    ).toBeVisible();
  } finally {
    await page.context().close();
  }
});
test("remaining Ask widgets have keyboard controls and preserve thread callbacks", async () => {
  const page = await askPage("", "/ask/components");
  try {
    await page
      .getByRole("combobox", { name: "Category", exact: true })
      .selectOption("career");
    await page
      .getByRole("combobox", { name: "Sort questions", exact: true })
      .selectOption("popular");
    const insight = page.getByRole("button", {
      name: "AI insight",
      exact: true,
    });
    await insight.focus();
    await page.keyboard.press("Enter");
    await expect(insight).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByText(
        "An AI-generated note accompanies the original community discussion.",
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Show all updates", exact: true })
      .click();
    await expect(page.locator(".ask-thread-update")).toHaveCount(3);
    await page
      .getByRole("button", { name: "Helpful update, 0 votes", exact: true })
      .click();
    assert.deepEqual(
      (await calls(page)).find((call) => call.name === "thread-vote")?.value,
      "update-0",
    );
  } finally {
    await page.context().close();
  }
});
test("small screens scroll dialogs, restore focus and preserve light/dark text contrast", async () => {
  const page = await askPage("", "/ask", { width: 320, height: 568 });
  try {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      const failed = await page.locator(".ask-shell").evaluate((root) => {
        const color = (value: string) => {
          const n = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0];
          return [...n.slice(0, 3), n[3] ?? 1];
        };
        const lum = (rgb: number[]) =>
          rgb
            .slice(0, 3)
            .map((channel) => {
              const v = channel / 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const bg = (element: Element | null): number[] => {
          if (!element) return [255, 255, 255, 1];
          const rgb = color(getComputedStyle(element).backgroundColor);
          return rgb[3] === 1 ? rgb : bg(element.parentElement);
        };
        return Array.from(
          root.querySelectorAll(
            "h1,h2,p,.ask-author-name,.ask-category,.ask-signal,.ask-question-footer button,.ask-sort button,.ask-expert-filter,.ask-topic",
          ),
        ).flatMap((element) => {
          const a = lum(color(getComputedStyle(element).color)),
            b = lum(bg(element)),
            ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          return ratio < 4.5 ? [{ text: element.textContent, ratio }] : [];
        });
      });
      assert.deepEqual(failed, [], theme);
      const dialog = await composer(page);
      await expect(
        dialog.getByRole("button", { name: "Publish question", exact: true }),
      ).toBeInViewport();
      for (const control of [
        dialog.locator("textarea"),
        dialog.getByRole("button", { name: "Publish question", exact: true }),
      ]) {
        assert.ok(
          await control.evaluate(
            (element) =>
              Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) >= 12,
          ),
          `${theme} rounded controls`,
        );
      }
      assert.equal(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
        true,
      );
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Ask a question", exact: true }),
      ).toBeFocused();
    }
  } finally {
    await page.context().close();
  }
});
