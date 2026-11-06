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
async function panelPage(
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
    process.stderr.write(`Notification fixture: ${error.message}\n`),
  );
  await page.goto(base + "/notification-fixture", { timeout: 60000 });
  await page.getByTestId("header-notifications").click();
  await expect(
    page.getByRole("dialog", { name: "Notifications", exact: true }),
  ).toBeVisible();
  return page;
}
const panel = (page: Page) =>
  page.getByRole("dialog", { name: "Notifications", exact: true });
const filter = (page: Page, name: string) =>
  panel(page)
    .getByRole("group", { name: "Filter notifications" })
    .getByRole("button", {
      name: new RegExp("^" + name + "(?:, \\d+ notifications)?$"),
    })
    .click();
const calls = (page: Page) =>
  page.evaluate(
    () =>
      (window as any).notificationFixture.calls as Array<{
        name: string;
        value?: any;
      }>,
  );
const options = async (page: Page, id: string) =>
  page
    .getByTestId("notification-" + id)
    .getByRole("button", { name: /^Options for / })
    .click();
const preferences = async (page: Page) => {
  await panel(page)
    .getByRole("button", { name: "Notification preferences", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Notification preferences",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
};

test("panel preserves raw unread counts and renders grouped updates with accurate titles and times", async () => {
  const page = await panelPage();
  try {
    await expect(
      panel(page).getByText("3 unread", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("notification-like-a")).toContainText(
      "Hana Tesfaye and Dawit Alemu liked your post",
    );
    await expect(page.getByTestId("notification-message-a")).toContainText(
      "Sent you 2 new messages",
    );
    assert.equal((await panel(page).innerText()).includes("NaN"), false);
    await expect(panel(page).getByText("undefined")).toHaveCount(0);
    assert.equal(
      await page.evaluate(
        () => (window as any).notificationFixture.state.notifications.length,
      ),
      8,
    );
    assert.deepEqual(await calls(page), []);
    await filter(page, "Social");
    await expect(panel(page).locator(".notification-entry")).toHaveCount(2);
    await filter(page, "Unread");
    await expect(panel(page).locator(".notification-entry")).toHaveCount(3);
    for (const [category, id] of [
      ["Circles", "circle"],
      ["Shop", "order"],
      ["Safety", "safety"],
      ["Messages", "message-a"],
    ]) {
      await filter(page, category);
      await expect(panel(page).locator(".notification-entry")).toHaveCount(1);
      await expect(page.getByTestId("notification-" + id)).toBeVisible();
    }
  } finally {
    await page.context().close();
  }
});
test("mixed read groups keep their unread marker and mark only the older unread notification", async () => {
  const page = await panelPage("mixed-batch");
  try {
    await expect(page.getByTestId("notification-like-a")).toHaveAttribute(
      "data-unread",
      "true",
    );
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
      panel(page).getByText("2 unread", { exact: true }),
    ).toBeVisible();
  } finally {
    await page.context().close();
  }
});
test("group deletion waits for the API and removes all underlying IDs without navigating", async () => {
  const page = await panelPage("pending-delete");
  try {
    await options(page, "like-a");
    await page
      .getByRole("menuitem", { name: "Delete 2 notifications", exact: true })
      .click();
    await expect(page.getByTestId("notification-like-a")).toBeVisible();
    await expect(
      panel(page).getByRole("button", { name: "Updating…", exact: true }),
    ).toBeDisabled();
    await expect(page.getByTestId("notification-like-a")).toHaveCount(0);
    await expect(panel(page).getByRole("status")).toHaveText(
      "Notification removed.",
    );
    assert.deepEqual(await calls(page), [
      { name: "delete", value: ["like-a", "like-b"] },
    ]);
    await expect(page.getByTestId("notification-path")).toHaveText(
      "/notification-fixture",
    );
  } finally {
    await page.context().close();
  }
});
test("failed row actions preserve the notification and never show false success", async () => {
  for (const scenario of ["mark-error", "delete-error"]) {
    const page = await panelPage(scenario);
    try {
      await options(page, "circle");
      await page
        .getByRole("menuitem", {
          name:
            scenario === "mark-error" ? "Mark as read" : "Delete notification",
          exact: true,
        })
        .click();
      await expect(panel(page).getByRole("alert")).toHaveText(
        "This change could not be saved. Please try again.",
      );
      await expect(page.getByTestId("notification-circle")).toHaveAttribute(
        "data-unread",
        "true",
      );
      await expect(panel(page).getByRole("status")).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  }
});
test("mark all updates counts on success and retains unread state after failure", async () => {
  for (const scenario of ["", "all-error"]) {
    const page = await panelPage(scenario);
    try {
      await panel(page)
        .getByRole("button", { name: "Mark all read", exact: true })
        .click();
      if (scenario) {
        await expect(panel(page).getByRole("alert")).toBeVisible();
        await expect(
          panel(page).getByText("3 unread", { exact: true }),
        ).toBeVisible();
      } else {
        await expect(panel(page).getByRole("status")).toHaveText(
          "All notifications marked as read.",
        );
        await expect(
          panel(page).getByRole("button", {
            name: "Mark all read",
            exact: true,
          }),
        ).toBeDisabled();
        await filter(page, "Unread");
        await expect(
          panel(page).getByRole("heading", { name: "You’re all caught up" }),
        ).toBeVisible();
      }
      assert.equal(
        (await calls(page)).filter((call) => call.name === "all").length,
        1,
      );
    } finally {
      await page.context().close();
    }
  }
});
test("opening activity preserves each existing destination and navigation state", async () => {
  for (const [id, path, state] of [
    ["like-a", "/post/sunrise", null],
    ["circle", "/circles/creative", null],
    ["message-a", "/messages", { conversationId: "chat-hana" }],
    ["order", "/order/notebook", null],
    ["safety", "/", { activeTab: "safe" }],
  ]) {
    const page = await panelPage();
    try {
      await page
        .getByTestId("notification-" + id)
        .getByRole("button", { name: /^(?!Options|View).*/ })
        .first()
        .click();
      await expect(panel(page)).toHaveCount(0);
      await expect(page.getByTestId("notification-path")).toHaveText(
        path as string,
      );
      if (state)
        await expect(page.getByTestId("notification-route-state")).toHaveText(
          JSON.stringify(state),
        );
    } finally {
      await page.context().close();
    }
  }
});
test("profile shortcut and view-all keep their destinations without marking unrelated notifications", async () => {
  const page = await panelPage();
  try {
    await page
      .getByRole("button", { name: "View Dawit Alemu’s profile", exact: true })
      .click();
    await expect(page.getByTestId("notification-path")).toHaveText(
      "/profile/dawit",
    );
    assert.deepEqual(await calls(page), []);
    await page.getByTestId("header-notifications").click();
    await panel(page)
      .getByRole("button", { name: "View all notifications", exact: true })
      .click();
    await expect(page.getByTestId("notification-path")).toHaveText(
      "/notifications",
    );
    assert.deepEqual(await calls(page), []);
  } finally {
    await page.context().close();
  }
});
test("Escape, outside click and browser Back dismiss the panel and restore trigger focus", async () => {
  const page = await panelPage();
  try {
    const trigger = page.getByTestId("header-notifications");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    await page.mouse.click(3, 800);
    await expect(panel(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.goBack();
    await expect(panel(page)).toHaveCount(0);
  } finally {
    await page.context().close();
  }
});
test("nested preferences stay above the dropdown, preserve it on close and restore focus", async () => {
  const page = await panelPage();
  try {
    const dialog = await preferences(page);
    await expect(dialog.getByRole("switch")).toHaveCount(15);
    await expect(
      dialog.getByRole("switch", { name: "SOS community alerts", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(panel(page)).toBeVisible();
    await expect(
      panel(page).getByRole("button", {
        name: "Notification preferences",
        exact: true,
      }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await page
      .getByRole("dialog", { name: "Notification preferences", exact: true })
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await expect(panel(page)).toBeVisible();
    assert.deepEqual(await calls(page), []);
  } finally {
    await page.context().close();
  }
});
test("preference switches save only explicit changes and master state disables category controls", async () => {
  const page = await panelPage();
  try {
    const dialog = await preferences(page);
    await dialog
      .getByRole("switch", { name: "Sound effects", exact: true })
      .click();
    await expect(
      dialog.getByRole("switch", { name: "Sound effects", exact: true }),
    ).not.toBeChecked();
    await expect(dialog.getByRole("status")).toHaveText("Preference saved.");
    await dialog
      .getByRole("switch", { name: "Allow notifications", exact: true })
      .click();
    await expect(
      dialog.getByRole("switch", { name: "Allow notifications", exact: true }),
    ).not.toBeChecked();
    await expect(
      dialog.getByRole("switch", { name: "Direct messages", exact: true }),
    ).toBeDisabled();
    assert.deepEqual(await calls(page), [
      { name: "preference", value: { sound_enabled: false } },
      { name: "preference", value: { enabled: false } },
    ]);
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await preferences(page);
    await expect(
      page.getByRole("switch", { name: "Allow notifications", exact: true }),
    ).not.toBeChecked();
  } finally {
    await page.context().close();
  }
});
test("failed preference loads and saves are explicit and do not show successful changes", async () => {
  for (const scenario of ["preference-error", "preference-load-error"]) {
    const page = await panelPage(scenario);
    try {
      const dialog = await preferences(page);
      if (scenario === "preference-load-error") {
        await expect(
          dialog.getByRole("heading", { name: "Preferences unavailable" }),
        ).toBeVisible();
        await expect(dialog.getByRole("switch")).toHaveCount(0);
        await dialog
          .getByRole("button", { name: "Try again", exact: true })
          .click();
        await expect(
          dialog.getByRole("switch", {
            name: "Allow notifications",
            exact: true,
          }),
        ).toBeVisible();
      } else {
        await dialog
          .getByRole("switch", { name: "Allow notifications", exact: true })
          .click();
        await expect(dialog.getByRole("alert")).toHaveText(
          "This preference could not be saved. Please try again.",
        );
        await expect(
          dialog.getByRole("switch", {
            name: "Allow notifications",
            exact: true,
          }),
        ).toBeChecked();
        await expect(dialog.getByRole("status")).toHaveCount(0);
      }
    } finally {
      await page.context().close();
    }
  }
});
test("loading and query failure remain distinct from a genuinely empty inbox", async () => {
  for (const scenario of [
    "loading",
    "load-error",
    "cached-error",
    "empty",
    "profile-error",
    "preference-loading",
  ]) {
    const page = await panelPage(scenario);
    try {
      if (scenario === "loading") {
        await expect(
          panel(page).getByRole("status", {
            name: "Loading notifications",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          panel(page).getByText("You’re all caught up", { exact: true }),
        ).toHaveCount(0);
      } else if (scenario === "load-error") {
        await expect(
          panel(page).getByRole("heading", {
            name: "Couldn’t load notifications",
          }),
        ).toBeVisible();
        await expect(
          panel(page).getByRole("heading", { name: "Your updates start here" }),
        ).toHaveCount(0);
        await panel(page)
          .getByRole("button", { name: "Try again", exact: true })
          .click();
        await expect(page.getByTestId("notification-circle")).toBeVisible();
      } else if (scenario === "cached-error") {
        await expect(panel(page).getByRole("alert")).toContainText(
          "last loaded notifications",
        );
        await expect(page.getByTestId("notification-circle")).toBeVisible();
        await panel(page)
          .getByRole("button", { name: "Retry", exact: true })
          .click();
        await expect(panel(page).getByRole("alert")).toHaveCount(0);
      } else if (scenario === "empty") {
        await expect(
          panel(page).getByRole("heading", { name: "Your updates start here" }),
        ).toBeVisible();
        await filter(page, "Unread");
        await expect(
          panel(page).getByRole("heading", { name: "You’re all caught up" }),
        ).toBeVisible();
      } else if (scenario === "profile-error") {
        await expect(page.getByTestId("notification-like-a")).toContainText(
          "2 people liked your post",
        );
        assert.equal(
          (await panel(page).innerText()).includes("undefined"),
          false,
        );
      } else {
        const dialog = await preferences(page);
        await expect(
          dialog.getByRole("status", {
            name: "Loading notification preferences",
            exact: true,
          }),
        ).toBeVisible();
        await expect(dialog.getByRole("switch")).toHaveCount(0);
      }
    } finally {
      await page.context().close();
    }
  }
});
test("long content and many updates scroll within a narrow short viewport without clipping the footer", async () => {
  for (const scenario of ["long", "many"]) {
    const page = await panelPage(scenario, { width: 320, height: 480 });
    try {
      assert.equal(
        await panel(page).evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.left >= 0 &&
            rect.right <= innerWidth &&
            rect.top >= 0 &&
            rect.bottom <= innerHeight &&
            element.scrollWidth <= element.clientWidth
          );
        }),
        true,
      );
      await expect(
        panel(page).getByRole("button", {
          name: "View all notifications",
          exact: true,
        }),
      ).toBeInViewport();
      await filter(page, "Messages");
      await expect(page.getByTestId("notification-message-a")).toBeVisible();
      const dialog = await preferences(page);
      await dialog
        .getByRole("switch", { name: "Helper responses", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        dialog.getByRole("button", { name: "Done", exact: true }),
      ).toBeInViewport();
      assert.equal(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
        true,
      );
    } finally {
      await page.context().close();
    }
  }
});
test("text contrast, touch targets, row menus and reduced motion work in light and dark themes", async () => {
  const page = await panelPage();
  try {
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      for (const preferencesOpen of [false, true]) {
        const root = preferencesOpen ? await preferences(page) : panel(page);
        const failures = await root.evaluate((root) => {
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
              "h2,h3,p,time,label,.notification-entry-title,.notification-entry-body,.notification-entry-meta,.notification-entry-state,.notification-filter,.notification-unread,.notification-mark-all,.notification-button",
            ),
          ).flatMap((element) => {
            if (!element.getBoundingClientRect().width) return [];
            const a = lum(color(getComputedStyle(element).color)),
              b = lum(background(element)),
              ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            return ratio < 4.5 ? [{ text: element.textContent, ratio }] : [];
          });
        });
        assert.deepEqual(failures, [], theme);
        assert.equal(
          await root
            .locator('button:not([role="switch"])')
            .evaluateAll((elements) =>
              elements.every(
                (element) => element.getBoundingClientRect().height >= 44,
              ),
            ),
          true,
        );
        if (preferencesOpen)
          await root.getByRole("button", { name: "Done", exact: true }).click();
      }
    }
    await options(page, "circle");
    await page.keyboard.press("End");
    await expect(
      page.getByRole("menuitem", { name: "Delete notification", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page
        .getByTestId("notification-circle")
        .getByRole("button", { name: /^Options for/ }),
    ).toBeFocused();
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await panel(page).evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
      "none",
    );
  } finally {
    await page.context().close();
  }
});
