import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, expect, type Browser, type Page } from "@playwright/test";
import type { ViteDevServer } from "vite";
import { startNotificationServer } from "./fixtures/notification-server.ts";
let server: ViteDevServer, browser: Browser, base: string;
before(async () => {
  server = await startNotificationServer();
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
});
async function notificationsPage(
  scenario = "",
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
    localStorage.setItem("notification-scenario", scenario);
    localStorage.setItem("theme", "light");
  }, scenario);
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    process.stderr.write(`Notifications page fixture: ${error.message}\n`),
  );
  await page.goto(base + "/notification-page-fixture", { timeout: 60000 });
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toBeVisible();
  return page;
}
const content = (page: Page) => page.locator(".notification-page");
const calls = (page: Page) =>
  page.evaluate(
    () =>
      (window as any).notificationFixture.calls as Array<{
        name: string;
        value?: any;
      }>,
  );
const filter = (page: Page, name: string) =>
  page
    .getByRole("group", { name: "Filter notifications" })
    .getByRole("button", {
      name: new RegExp("^" + name + "(?:, \\d+ notifications)?$"),
    })
    .click();
const options = async (page: Page, id: string) =>
  page
    .getByTestId("notification-" + id)
    .getByRole("button", { name: /^Options for/ })
    .click();
const openClear = async (page: Page) => {
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Clear all notifications?",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
};
const openStory = async (page: Page) => {
  await page
    .getByTestId("notification-story")
    .locator(".notification-open")
    .click();
  const dialog = page.getByRole("alertdialog", {
    name: "Reshare to your story?",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
};

test("full page shares activity cards, correct batch titles and every category without changing counts", async () => {
  const page = await notificationsPage();
  try {
    await expect(
      content(page).getByText("3 unread", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("notification-like-a")).toContainText(
      "Hana Tesfaye and Dawit Alemu liked your post",
    );
    await expect(content(page).locator(".notification-entry")).toHaveCount(6);
    assert.equal((await content(page).innerText()).includes("NaN"), false);
    assert.equal(
      await page.evaluate(
        () => (window as any).notificationFixture.state.notifications.length,
      ),
      8,
    );
    assert.deepEqual(await calls(page), []);
    for (const [category, count] of [
      ["All", 6],
      ["Unread", 3],
      ["Social", 2],
      ["Circles", 1],
      ["Shop", 1],
      ["Safety", 1],
      ["Messages", 1],
    ] as const) {
      await filter(page, category);
      await expect(content(page).locator(".notification-entry")).toHaveCount(
        count,
      );
    }
    assert.equal(
      await page
        .getByTestId("nav-home")
        .evaluate((element) => element.closest(".notification-ui") === null),
      true,
    );
    assert.equal(
      await page
        .getByTestId("nav-home")
        .evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).height),
        ),
      40,
    );
  } finally {
    await page.context().close();
  }
});
test("full page shows all loaded activity rather than the dropdown’s 15-entry preview", async () => {
  const page = await notificationsPage("many");
  try {
    await expect(content(page).locator(".notification-entry")).toHaveCount(36);
    await expect(page.getByTestId("notification-extra-29")).toBeAttached();
    assert.equal(
      await page.evaluate(
        () => (window as any).notificationFixture.state.notifications.length,
      ),
      38,
    );
  } finally {
    await page.context().close();
  }
});
test("group actions mark only unread records and update counts after successful writes", async () => {
  const page = await notificationsPage("mixed-batch");
  try {
    await options(page, "like-a");
    await page
      .getByRole("menuitem", { name: "Mark as read", exact: true })
      .click();
    await expect(page.getByTestId("notification-like-a")).toHaveAttribute(
      "data-unread",
      "false",
    );
    assert.deepEqual(await calls(page), [{ name: "mark", value: "like-b" }]);
    await expect(
      content(page).getByText("2 unread", { exact: true }),
    ).toBeVisible();
    await content(page)
      .getByRole("button", { name: "Mark all read", exact: true })
      .click();
    await expect(content(page).getByRole("status")).toHaveText(
      "All notifications marked as read.",
    );
    await filter(page, "Unread");
    await expect(
      content(page).getByRole("heading", {
        name: "You’re all caught up",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await page.context().close();
  }
});
test("clear all is confirmed, waits for success and clears every category from a filtered view", async () => {
  const page = await notificationsPage("pending-clear");
  try {
    await filter(page, "Messages");
    let dialog = await openClear(page);
    await expect(dialog).toContainText("every category");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Clear all", exact: true }),
    ).toBeFocused();
    assert.deepEqual(await calls(page), []);
    dialog = await openClear(page);
    await dialog
      .getByRole("button", { name: "Clear all notifications", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: /Clear all notifications/ }),
    ).toBeDisabled();
    assert.equal(
      await page.evaluate(
        () => (window as any).notificationFixture.state.notifications.length,
      ),
      8,
    );
    await expect(dialog).toHaveCount(0);
    assert.equal(
      await page.evaluate(
        () => (window as any).notificationFixture.state.notifications.length,
      ),
      0,
    );
    assert.equal(
      (await calls(page)).filter((call) => call.name === "clear").length,
      1,
    );
    await expect(content(page).getByRole("status")).toHaveText(
      "All notifications cleared.",
    );
    await expect(
      page.getByRole("heading", { name: "Notifications", exact: true }),
    ).toBeFocused();
  } finally {
    await page.context().close();
  }
});
test("failed clear and row actions preserve activity and never claim success", async () => {
  for (const scenario of ["clear-error", "delete-error", "all-error"]) {
    const page = await notificationsPage(scenario);
    try {
      if (scenario === "clear-error") {
        const dialog = await openClear(page);
        await dialog
          .getByRole("button", { name: "Clear all notifications", exact: true })
          .click();
        await expect(dialog.getByRole("alert")).toHaveText(
          "Notifications could not be cleared. Please try again.",
        );
        await expect(dialog).toBeVisible();
        await dialog
          .getByRole("button", { name: "Cancel", exact: true })
          .click();
      } else if (scenario === "delete-error") {
        await options(page, "circle");
        await page
          .getByRole("menuitem", { name: "Delete notification", exact: true })
          .click();
        await expect(content(page).getByRole("alert")).toBeVisible();
        await expect(page.getByTestId("notification-circle")).toBeVisible();
      } else {
        await page
          .getByRole("button", { name: "Mark all read", exact: true })
          .click();
        await expect(content(page).getByRole("alert")).toBeVisible();
      }
      assert.equal(
        await page.evaluate(
          () => (window as any).notificationFixture.state.notifications.length,
        ),
        8,
      );
      await expect(content(page).getByRole("status")).toHaveCount(0);
      await expect(
        content(page).getByText("3 unread", { exact: true }),
      ).toBeVisible();
    } finally {
      await page.context().close();
    }
  }
});
test("story reshare requires confirmation, prevents repeated submissions and preserves the existing payload", async () => {
  const page = await notificationsPage("story-pending");
  try {
    let dialog = await openStory(page);
    await expect(dialog).toContainText("Hana Tesfaye");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(
      (await calls(page)).filter((call) => call.name === "reshare").length,
      0,
    );
    await expect(
      page.getByTestId("notification-story").locator(".notification-open"),
    ).toBeFocused();
    dialog = await openStory(page);
    await dialog
      .getByRole("button", { name: "Reshare story", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: /Reshare story/ }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(content(page).getByRole("status")).toHaveText(
      "Story reshared to your profile.",
    );
    const writes = (await calls(page)).filter(
      (call) => call.name === "reshare",
    );
    assert.equal(writes.length, 1);
    assert.equal(writes[0].value.user_id, "fixture-user");
    assert.equal(writes[0].value.reshared_story_id, "story-original");
    assert.equal(writes[0].value.media_url, "https://example.test/story.jpg");
    assert.ok(
      Math.abs(
        new Date(writes[0].value.expires_at).getTime() - Date.now() - 86400000,
      ) < 15000,
    );
  } finally {
    await page.context().close();
  }
});
test("failed story lookup or insertion keeps the confirmation open with a retryable error", async () => {
  for (const scenario of ["story-error", "reshare-error"]) {
    const page = await notificationsPage(scenario);
    try {
      const dialog = await openStory(page);
      await dialog
        .getByRole("button", { name: "Reshare story", exact: true })
        .click();
      await expect(dialog.getByRole("alert")).toHaveText(
        "This story could not be reshared. Please try again.",
      );
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Reshare story", exact: true }),
      ).toBeEnabled();
      assert.equal(
        (await calls(page)).filter((call) => call.name === "reshare").length,
        scenario === "story-error" ? 0 : 1,
      );
      await expect(
        content(page).getByText("Story reshared to your profile.", {
          exact: true,
        }),
      ).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  }
});
test("activity links, preferences and home navigation retain their existing destinations and focus", async () => {
  const page = await notificationsPage();
  try {
    const trigger = page.getByRole("button", {
      name: "Notification preferences",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Notification preferences",
      exact: true,
    });
    await expect(dialog.getByRole("switch")).toHaveCount(15);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await filter(page, "Messages");
    await page
      .getByTestId("notification-message-a")
      .locator(".notification-open")
      .click();
    await expect(page.getByTestId("notification-page-path")).toHaveText(
      "/messages",
    );
    await expect(page.getByTestId("notification-page-route-state")).toHaveText(
      JSON.stringify({ conversationId: "chat-hana" }),
    );
  } finally {
    await page.context().close();
  }
  const home = await notificationsPage();
  try {
    await home
      .getByRole("button", { name: "Back to home", exact: true })
      .click();
    await expect(home.getByTestId("notification-page-path")).toHaveText("/");
  } finally {
    await home.context().close();
  }
});
test("loading, errors, cached data and a genuinely empty inbox have distinct states", async () => {
  for (const scenario of [
    "loading",
    "load-error",
    "cached-error",
    "empty",
    "profile-error",
  ]) {
    const page = await notificationsPage(scenario);
    try {
      if (scenario === "loading") {
        await expect(
          content(page).getByRole("status", {
            name: "Loading notifications",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          content(page).getByText("You’re all caught up", { exact: true }),
        ).toHaveCount(0);
      } else if (scenario === "load-error") {
        await expect(
          page.getByRole("heading", { name: "Couldn’t load notifications" }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Your updates start here" }),
        ).toHaveCount(0);
        await page
          .getByRole("button", { name: "Try again", exact: true })
          .click();
        await expect(page.getByTestId("notification-circle")).toBeVisible();
      } else if (scenario === "cached-error") {
        await expect(content(page).getByRole("alert")).toContainText(
          "last loaded updates",
        );
        await expect(page.getByTestId("notification-circle")).toBeVisible();
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await expect(content(page).getByRole("alert")).toHaveCount(0);
      } else if (scenario === "empty") {
        await expect(
          page.getByRole("heading", { name: "Your updates start here" }),
        ).toBeVisible();
        await filter(page, "Unread");
        await expect(
          page.getByRole("heading", { name: "You’re all caught up" }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Clear all", exact: true }),
        ).toHaveCount(0);
      } else
        await expect(page.getByTestId("notification-like-a")).toContainText(
          "2 people liked your post",
        );
    } finally {
      await page.context().close();
    }
  }
});
test("mention updates are scoped to the current account", async () => {
  const page = await notificationsPage();
  try {
    const filters = await page.evaluate(() =>
      (window as any).notificationFixture.subscriptions.map(
        (subscription: any) => subscription.options.filter,
      ),
    );
    assert.deepEqual(filters, ["user_id=eq.fixture-user"]);
    await page.evaluate(() => {
      const handler = (window as any).notificationFixture.subscriptions[0]
        .handler;
      handler({
        new: { user_id: "another-user", notification_type: "story_mention" },
      });
    });
    await expect(
      page.getByText("Someone mentioned you!", { exact: true }),
    ).toHaveCount(0);
    await page.evaluate(() =>
      (window as any).notificationFixture.subscriptions[0].handler({
        new: { user_id: "fixture-user", notification_type: "story_mention" },
      }),
    );
    await expect(
      page.getByText("Someone mentioned you!", { exact: true }),
    ).toBeVisible();
  } finally {
    await page.context().close();
  }
});
test("narrow screens retain sticky filters, readable long content and access above the unchanged navbar", async () => {
  const page = await notificationsPage("long", { width: 320, height: 568 });
  try {
    assert.equal(
      await content(page).evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const last = page.getByTestId("notification-follow");
    await last.scrollIntoViewIfNeeded();
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const row = await last.boundingBox(),
      nav = await page
        .getByRole("navigation", { name: "Primary", exact: true })
        .boundingBox();
    assert.ok(row && nav && row.y + row.height <= nav.y);
    const filters = await page
      .getByRole("group", { name: "Filter notifications" })
      .boundingBox();
    assert.ok(filters && filters.y >= 76 && filters.y < 100);
    await filter(page, "Messages");
    await expect(page.getByTestId("notification-message-a")).toBeVisible();
    await expect(page.getByTestId("nav-home")).toBeVisible();
  } finally {
    await page.context().close();
  }
});
test("page text, dialogs and touch controls remain accessible in light and dark mode", async () => {
  const page = await notificationsPage();
  try {
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      const failures = await content(page).evaluate((root) => {
        const color = (value: string) => {
          const numbers = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0];
          return [...numbers.slice(0, 3), numbers[3] ?? 1];
        };
        const lum = (rgb: number[]) =>
          rgb
            .slice(0, 3)
            .map((channel) => {
              const v = channel / 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const background = (element: Element | null): number[] => {
          if (!element) return [255, 255, 255, 1];
          const rgb = color(getComputedStyle(element).backgroundColor);
          return rgb[3] === 1 ? rgb : background(element.parentElement);
        };
        return Array.from(
          root.querySelectorAll(
            "h1,h2,h3,p,time,.notification-unread,.notification-mark-all,.notification-page-clear,.notification-filter,.notification-entry-title,.notification-entry-body,.notification-entry-meta,.notification-entry-state",
          ),
        ).flatMap((element) => {
          const a = lum(color(getComputedStyle(element).color)),
            b = lum(background(element)),
            ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          return ratio < 4.5 ? [{ text: element.textContent, ratio }] : [];
        });
      });
      assert.deepEqual(failures, [], theme);
      assert.equal(
        await content(page)
          .locator("button")
          .evaluateAll((elements) =>
            elements.every(
              (element) => element.getBoundingClientRect().height >= 44,
            ),
          ),
        true,
      );
      const dialog = await openClear(page);
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Clear all", exact: true }),
      ).toBeFocused();
    }
  } finally {
    await page.context().close();
  }
});
