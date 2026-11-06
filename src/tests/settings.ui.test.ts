import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, expect, type Browser, type Page } from "@playwright/test";
import type { ViteDevServer } from "vite";
import { startSettingsServer } from "./fixtures/settings-server.ts";

let server: ViteDevServer, browser: Browser, base: string;
before(async () => {
  server = await startSettingsServer();
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
async function settingsPage(
  scenario = "",
  viewport = { width: 390, height: 844 },
  query = "",
) {
  const context = await browser.newContext({ viewport, colorScheme: "light" });
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
    if (!localStorage.getItem("settings-fixture-initialized")) {
      localStorage.setItem("settings-fixture-initialized", "true");
      localStorage.setItem("settings-scenario", scenario);
      localStorage.setItem("theme", "light");
    }
    (window as any).cacheDeletes = [];
    (window as any).databaseDeletes = [];
    Object.defineProperty(navigator.storage, "estimate", {
      configurable: true,
      value: async () => {
        if (scenario === "storage-error") throw new Error("Unavailable");
        return {
          usage: 10485760,
          quota: scenario === "zero-quota" ? 0 : 104857600,
        };
      },
    });
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        keys: async () => ["fixture-cache"],
        delete: async (name: string) => {
          (window as any).cacheDeletes.push(name);
          return true;
        },
      },
    });
    indexedDB.deleteDatabase = (name: string) => {
      (window as any).databaseDeletes.push(name);
      throw new Error("Must preserve offline databases");
    };
  }, scenario);
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    process.stderr.write(`Settings fixture: ${error.message}\n`),
  );
  await page.goto(base + "/settings-fixture" + query, { timeout: 60000 });
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  return page;
}
const category = async (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Settings categories" })
    .getByRole("button", { name, exact: true })
    .click();
const calls = (page: Page) =>
  page.evaluate(
    () =>
      (window as any).settingsFixture.calls as Array<{
        name: string;
        value?: any;
      }>,
  );

test("Settings keeps all categories and existing controls in a responsive layout", async () => {
  const page = await settingsPage("", { width: 320, height: 568 });
  try {
    await expect(
      page.getByRole("radiogroup", { name: "Appearance" }),
    ).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Autoplay videos", exact: true }),
    ).toBeVisible();
    for (const name of [
      "General",
      "Privacy",
      "Notifications",
      "Account & security",
      "Storage",
    ]) {
      await category(page, name);
      assert.equal(
        await page
          .locator(".settings-screen")
          .evaluate((element) => element.scrollWidth <= innerWidth),
        true,
      );
      assert.equal(
        await page
          .locator(".settings-main")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
        true,
      );
    }
    await page
      .getByRole("button", { name: "Log out", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Log out", exact: true }),
    ).toBeInViewport();
    assert.deepEqual(
      (await calls(page)).filter((call) => call.name === "sign-out"),
      [],
    );
  } finally {
    await page.context().close();
  }
});
test("keyboard Escape and nested Back restore focus without changing account data", async () => {
  const page = await settingsPage();
  try {
    await category(page, "Privacy");
    await page
      .getByRole("button", { name: "Back to general settings" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Make Serkle yours" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Open settings", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Settings", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .getByRole("dialog")
        .evaluate((element) => element.contains(document.activeElement)),
      true,
    );
    assert.deepEqual(await calls(page), []);
  } finally {
    await page.context().close();
  }
});
test("appearance follows shared theme, reacts to system changes and survives reopening and reload", async () => {
  const page = await settingsPage();
  try {
    await page.getByRole("radio", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("radio", { name: "System", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page
      .getByRole("button", { name: "Close settings", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Open settings", exact: true })
      .click();
    await expect(
      page.getByRole("radio", { name: "System", exact: true }),
    ).toBeChecked();
    await page.reload();
    await expect(
      page.getByRole("radio", { name: "System", exact: true }),
    ).toBeChecked();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("theme")),
      "system",
    );
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  } finally {
    await page.context().close();
  }
});
test("autoplay preference persists on this device", async () => {
  const page = await settingsPage();
  try {
    await page
      .getByRole("switch", { name: "Autoplay videos", exact: true })
      .click();
    await expect(
      page.getByRole("switch", { name: "Autoplay videos", exact: true }),
    ).not.toBeChecked();
    await page.reload();
    await expect(
      page.getByRole("switch", { name: "Autoplay videos", exact: true }),
    ).not.toBeChecked();
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("settings-autoplay-videos"),
      ),
      "false",
    );
  } finally {
    await page.context().close();
  }
});
test("privacy changes save once, use mapped columns and retain values across reload", async () => {
  const page = await settingsPage();
  try {
    await category(page, "Privacy");
    await page
      .getByRole("switch", { name: "Private account", exact: true })
      .click();
    await expect(
      page.getByRole("switch", { name: "Private account", exact: true }),
    ).toBeChecked();
    await expect(page.getByRole("status")).toHaveText("Settings saved.");
    await page
      .getByRole("switch", { name: "Hide follower counts", exact: true })
      .click();
    await expect(
      page.getByRole("switch", { name: "Hide follower counts", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("switch", { name: "Hide online status", exact: true })
      .click();
    await expect(
      page.getByRole("switch", { name: "Hide online status", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("combobox", { name: "Allow messages from" })
      .selectOption("nobody");
    await expect(page.getByRole("combobox")).toHaveValue("nobody");
    assert.deepEqual(await calls(page), [
      { name: "profile", value: { is_private: true } },
      { name: "profile", value: { hide_followers: true } },
      { name: "profile", value: { hide_online_status: true } },
      { name: "profile", value: { allow_messages_from: "nobody" } },
    ]);
    await page.reload();
    await category(page, "Privacy");
    await expect(
      page.getByRole("switch", { name: "Private account", exact: true }),
    ).toBeChecked();
    await expect(page.getByRole("combobox")).toHaveValue("nobody");
    await page
      .getByRole("switch", { name: "Private account", exact: true })
      .click();
    await expect(
      page.getByRole("switch", { name: "Private account", exact: true }),
    ).not.toBeChecked();
    assert.deepEqual(await calls(page), [
      { name: "profile", value: { is_private: false } },
    ]);
  } finally {
    await page.context().close();
  }
});
test("failed privacy save keeps the original value and shows failure instead of success", async () => {
  const page = await settingsPage("save-error");
  try {
    await category(page, "Privacy");
    await page
      .getByRole("switch", { name: "Private account", exact: true })
      .click();
    await expect(page.getByRole("alert")).toHaveText("Fixture save failed");
    await expect(
      page.getByRole("switch", { name: "Private account", exact: true }),
    ).not.toBeChecked();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(
      page.getByRole("switch", { name: "Private account", exact: true }),
    ).toBeEnabled();
  } finally {
    await page.context().close();
  }
});
test("account details show masked auth data and accurate verified or unavailable states", async () => {
  for (const state of ["", "unverified", "account-error", "no-email"]) {
    const page = await settingsPage(state);
    try {
      await category(page, "Account & security");
      if (state === "account-error") {
        await expect(page.getByRole("alert")).toHaveText(
          "Account details could not be loaded.",
        );
        await expect(
          page.getByRole("button", { name: "Change password", exact: true }),
        ).toBeDisabled();
        await expect(page.getByText("Not set", { exact: true })).toHaveCount(0);
      } else if (state === "no-email") {
        await expect(
          page.getByRole("button", { name: "Change password", exact: true }),
        ).toBeDisabled();
        await page
          .getByRole("button", { name: "Enter email", exact: true })
          .click();
        await expect(page.getByTestId("settings-path")).toHaveText(
          "/email-address",
        );
      } else {
        await expect(
          page.getByText("h••a@example.test", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("••••••••4567", { exact: true }),
        ).toBeVisible();
        if (state === "unverified") {
          await page
            .getByRole("button", { name: "Verify email", exact: true })
            .click();
          assert.equal(
            (await calls(page)).filter((call) => call.name === "resend").length,
            1,
          );
        } else
          await expect(
            page.getByText("Verified", { exact: true }),
          ).toBeVisible();
      }
    } finally {
      await page.context().close();
    }
  }
});
test("password dialog validates recovery and confirmation, keeps focus and clears secrets on close", async () => {
  const page = await settingsPage();
  try {
    await category(page, "Account & security");
    const opener = page.getByRole("button", {
      name: "Change password",
      exact: true,
    });
    await opener.click();
    const dialog = page.getByRole("dialog", {
      name: "Change password",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    assert.deepEqual(await calls(page), []);
    await dialog
      .getByRole("button", { name: "Send recovery email", exact: true })
      .click();
    await dialog.getByLabel("Recovery code", { exact: true }).fill("000000");
    await dialog
      .getByRole("button", { name: "Verify code", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Invalid or expired code",
    );
    await expect(
      dialog.getByLabel("New password", { exact: true }),
    ).toHaveCount(0);
    await dialog.getByLabel("Recovery code", { exact: true }).fill("123456");
    await dialog
      .getByRole("button", { name: "Verify code", exact: true })
      .click();
    await dialog.getByLabel("New password", { exact: true }).fill("short");
    await dialog.getByLabel("Confirm password", { exact: true }).fill("short");
    await dialog
      .getByRole("button", { name: "Update password", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Use at least 6 characters.",
    );
    await dialog
      .getByLabel("New password", { exact: true })
      .fill("fixture-password");
    await dialog
      .getByRole("button", { name: "Update password", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Passwords do not match.",
    );
    await dialog
      .getByLabel("Confirm password", { exact: true })
      .fill("fixture-password");
    await dialog
      .getByRole("button", { name: "Update password", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    assert.deepEqual(
      (await calls(page)).filter((call) => call.name === "update-user"),
      [{ name: "update-user", value: { password: "fixture-password" } }],
    );
    await opener.click();
    await expect(
      page.getByRole("button", { name: "Send recovery email", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  } finally {
    await page.context().close();
  }
});
test("cache confirmation preserves offline databases and reports actual completion or failure", async () => {
  for (const state of ["", "cache-error"]) {
    const page = await settingsPage(state);
    try {
      await category(page, "Storage");
      await expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "10",
      );
      const opener = page.getByRole("button", {
        name: "Clear cache",
        exact: true,
      });
      await opener.click();
      const dialog = page.getByRole("alertdialog", {
        name: "Clear app cache?",
        exact: true,
      });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(opener).toBeFocused();
      assert.deepEqual(await calls(page), []);
      await opener.click();
      await dialog
        .getByRole("button", { name: "Clear app cache", exact: true })
        .click();
      if (state === "cache-error")
        await expect(page.getByRole("alert")).toHaveText(
          "Cache could not be fully cleared. Please try again.",
        );
      else
        await expect(page.getByRole("status")).toHaveText("App cache cleared.");
      assert.deepEqual(
        await page.evaluate(() => (window as any).databaseDeletes),
        [],
      );
      assert.deepEqual(
        await page.evaluate(() => (window as any).cacheDeletes),
        state ? [] : ["fixture-cache"],
      );
      assert.deepEqual(await calls(page), [{ name: "clear-query-cache" }]);
    } finally {
      await page.context().close();
    }
  }
});
test("unknown storage estimates do not show fabricated progress", async () => {
  for (const state of ["storage-error", "zero-quota"]) {
    const page = await settingsPage(state);
    try {
      await category(page, "Storage");
      await expect(page.getByRole("progressbar")).toHaveCount(0);
      await expect(
        page.getByText(
          state === "storage-error"
            ? "Storage usage is unavailable in this browser."
            : "Storage limit not reported",
          { exact: true },
        ),
      ).toBeVisible();
    } finally {
      await page.context().close();
    }
  }
});
test("notification permission states expose the appropriate actions without requesting permission on open", async () => {
  for (const state of ["", "denied", "unsupported", "granted"]) {
    const page = await settingsPage(state);
    try {
      await category(page, "Notifications");
      assert.deepEqual(await calls(page), []);
      if (state === "unsupported") {
        await expect(
          page.getByRole("heading", { name: "Not supported here" }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", {
            name: "Enable notifications",
            exact: true,
          }),
        ).toHaveCount(0);
      } else if (state === "denied") {
        await expect(
          page.getByRole("button", {
            name: "Enable notifications",
            exact: true,
          }),
        ).toBeDisabled();
        await expect(
          page.getByRole("button", { name: "Force re-enable", exact: true }),
        ).toBeDisabled();
      } else {
        if (!state) {
          await page
            .getByRole("button", { name: "Enable notifications", exact: true })
            .click();
          await expect(page.getByRole("status")).toHaveText(
            "Browser permission granted. Send a test to check delivery.",
          );
        }
        await page
          .getByRole("button", { name: "Send test notification", exact: true })
          .click();
        assert.equal(
          (await calls(page)).filter((call) => call.name === "push-test")
            .length,
          1,
        );
        await page
          .getByRole("button", { name: "Force re-enable", exact: true })
          .click();
        await page
          .getByRole("alertdialog", {
            name: "Reconnect notifications?",
            exact: true,
          })
          .getByRole("button", { name: "Cancel", exact: true })
          .click();
        assert.equal(
          (await calls(page)).filter((call) => call.name === "push-reset")
            .length,
          0,
        );
      }
    } finally {
      await page.context().close();
    }
  }
});
test("notification reconnect consumes URL intent and resumes setup after reload", async () => {
  const page = await settingsPage("granted");
  try {
    await category(page, "Notifications");
    await page
      .getByRole("button", { name: "Force re-enable", exact: true })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Reconnect device", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("push-reset-recorded")),
      )
      .toBe("true");
    await expect(
      page.getByRole("heading", { name: "Stay in the loop" }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (await calls(page)).filter((call) => call.name === "push-enable")
            .length,
      )
      .toBe(1);
    assert.equal(new URL(page.url()).search, "");
  } finally {
    await page.context().close();
  }
});
test("install acceptance waits for the browser installed event before showing installed", async () => {
  const page = await settingsPage();
  try {
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "accepted" }),
      });
      window.dispatchEvent(event);
    });
    await page
      .getByRole("button", { name: "Install now", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Installation requested. Follow your browser’s instructions.",
    );
    await expect(
      page.getByText("Installed on this device.", { exact: true }),
    ).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(
      page.getByText("Installed on this device.", { exact: true }),
    ).toBeVisible();
  } finally {
    await page.context().close();
  }
});
test("core Settings text and controls retain readable contrast in both themes", async () => {
  const page = await settingsPage();
  try {
    for (const theme of ["Light", "Dark"]) {
      await category(page, "General");
      await page.getByRole("radio", { name: theme, exact: true }).click();
      for (const name of [
        "General",
        "Privacy",
        "Notifications",
        "Account & security",
        "Storage",
      ]) {
        await category(page, name);
        const failed = await page
          .locator(".settings-screen")
          .evaluate((root) => {
            const color = (value: string) => {
              const parts = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0];
              return [parts[0], parts[1], parts[2], parts[3] ?? 1];
            };
            const lum = (rgb: number[]) =>
              rgb
                .slice(0, 3)
                .map((channel) => {
                  const value = channel / 255;
                  return value <= 0.04045
                    ? value / 12.92
                    : ((value + 0.055) / 1.055) ** 2.4;
                })
                .reduce(
                  (sum, value, index) =>
                    sum + value * [0.2126, 0.7152, 0.0722][index],
                  0,
                );
            const background = (element: Element | null): number[] => {
              if (!element) return [255, 255, 255, 1];
              const rgb = color(getComputedStyle(element).backgroundColor);
              return rgb[3] === 1 ? rgb : background(element.parentElement);
            };
            const failures = Array.from(
              root.querySelectorAll(
                "h1,h2,h3,p,strong,label,select,.settings-nav button,.settings-theme,.settings-badge,.settings-button:not(:disabled)",
              ),
            ).flatMap((element) => {
              if (!element.getBoundingClientRect().width) return [];
              const a = lum(color(getComputedStyle(element).color)),
                b = lum(background(element)),
                ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
              return ratio < 4.5 ? [{ text: element.textContent, ratio }] : [];
            });
            for (const track of root.querySelectorAll('[role="switch"]')) {
              const trackLum = lum(background(track)),
                parentLum = lum(background(track.parentElement));
              const thumbLum = lum(background(track.firstElementChild));
              const ratio = (a: number, b: number) =>
                (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
              if (ratio(trackLum, parentLum) < 3)
                failures.push({
                  text: "Switch track contrast",
                  ratio: ratio(trackLum, parentLum),
                });
              if (ratio(trackLum, thumbLum) < 3)
                failures.push({
                  text: "Switch thumb contrast",
                  ratio: ratio(trackLum, thumbLum),
                });
              const target = track.closest("label")!.getBoundingClientRect();
              if (target.width < 44 || target.height < 44)
                failures.push({ text: "Switch touch target", ratio: 0 });
            }
            return failures;
          });
        assert.deepEqual(failed, [], `${theme}: ${name}`);
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".settings-panel")
        .evaluate((element) => getComputedStyle(element).animationName),
      "none",
    );
  } finally {
    await page.context().close();
  }
});
