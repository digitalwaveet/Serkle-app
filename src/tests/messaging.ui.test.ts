import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdir } from "node:fs/promises";
import { chromium, expect, type Browser, type Page } from "@playwright/test";
import type { ViteDevServer } from "vite";
import { startMessagesServer } from "./fixtures/messages-server.ts";
let browser: Browser, server: ViteDevServer, base: string;
const errors: string[] = [];
const dm = "10000000-0000-4000-8000-000000000001",
  group = "10000000-0000-4000-8000-000000000002";
const artifact =
  process.env.MESSAGING_SCREENSHOT_DIR || "test-results/messages";
before(async () => {
  server = await startMessagesServer();
  const address = server.httpServer!.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : ""}`;
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-proxy-server"],
  });
  await mkdir(artifact, { recursive: true });
});
after(async () => {
  await browser?.close();
  await server?.close();
  assert.deepEqual(errors, [], "Messaging fixture browser errors");
});
async function pageFor(
  scenario = "",
  path = "/messages",
  width = 390,
  dark = false,
) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
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
  await context.addInitScript(
    ({ scenario, dark }) => {
      localStorage.setItem("messages-scenario", scenario);
      localStorage.setItem("theme", dark ? "dark" : "light");
      if (scenario === "voice-record") {
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: {
            getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
          },
        });
        (window as any).MediaRecorder = class {
          static isTypeSupported() {
            return true;
          }
          state = "inactive";
          ondataavailable: any;
          onstop: any;
          start() {
            this.state = "recording";
          }
          stop() {
            this.state = "inactive";
            this.ondataavailable?.({
              data: new Blob([new Uint8Array(1024)], { type: "audio/webm" }),
            });
            queueMicrotask(() => this.onstop?.());
          }
        };
      }
    },
    { scenario, dark },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    errors.push(error.message);
    process.stderr.write(error.message + "\n");
  });
  await page.goto(base + path, { timeout: 60000 });
  return page;
}
const calls = (page: Page) =>
  page.evaluate(
    () =>
      (window as any).messagesFixture.calls as Array<{
        name: string;
        value: any;
      }>,
  );
const fail = (page: Page, name: string) =>
  page.evaluate(
    (name) => (window as any).messagesFixture.setFailure(name),
    name,
  );
test("shared photo opens a focus-trapped viewer and Escape returns to the conversation", async () => {
  const page = await pageFor("", `/messages/${dm}`);
  try {
    await page
      .getByRole("button", { name: "Open shared photo", exact: true })
      .click();
    const viewer = page.getByRole("dialog", {
      name: "Media viewer",
      exact: true,
    });
    await expect(viewer).toBeVisible();
    await expect(
      viewer.getByRole("button", { name: "Close media viewer", exact: true }),
    ).toBeFocused();
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    assert.equal(
      await viewer.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      true,
    );
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Open shared photo", exact: true }),
    ).toBeFocused();
  } finally {
    await page.context().close();
  }
});
test("voice recording works from the keyboard and a failed send retains the recording for safe retry", async () => {
  const page = await pageFor("voice-record", `/messages/${dm}`);
  try {
    await fail(page, "send");
    await page
      .getByRole("button", { name: "Record voice message", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("button", { name: "Send recording", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "recording could not be sent",
    );
    await page
      .getByRole("button", { name: "Retry recording", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Record voice message", exact: true }),
    ).toBeVisible();
    const requests = await calls(page),
      sends = requests.filter((call) => call.name === "send");
    assert.equal(requests.filter((call) => call.name === "upload").length, 1);
    assert.equal(sends.length, 2);
    assert.equal(sends[0].value.id, sends[1].value.id);
    assert.equal(sends[0].value.content, sends[1].value.content);
  } finally {
    await page.context().close();
  }
});
test("group invitation QR is generated locally, copying reports success, and revocation is confirmed", async () => {
  const page = await pageFor("owner", `/messages/${group}`);
  try {
    await page
      .getByRole("button", { name: "Open group profile", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Group profile", exact: true })
      .getByRole("button", { name: "Invite", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Invite to this group",
      exact: true,
    });
    await expect(
      dialog.getByRole("img", {
        name: "Scan this QR code to open the group invitation",
        exact: true,
      }),
    ).toHaveAttribute("src", /^data:image\//);
    await dialog
      .getByRole("button", { name: "Copy invitation link", exact: true })
      .click();
    await expect(dialog.getByRole("status")).toHaveText(
      "Invitation link copied",
    );
    await dialog
      .getByRole("button", { name: "Revoke invitation link", exact: true })
      .click();
    const confirm = page.getByRole("alertdialog", {
      name: "Revoke invitation link?",
      exact: true,
    });
    assert.equal(
      (await calls(page)).filter(
        (call) => call.name === "revoke_chat_group_invite",
      ).length,
      0,
    );
    await confirm
      .getByRole("button", { name: "Revoke link", exact: true })
      .click();
    await expect(confirm).toBeHidden();
    await expect(dialog).toBeHidden();
    assert.equal(
      (await calls(page)).filter(
        (call) => call.name === "revoke_chat_group_invite",
      ).length,
      1,
    );
  } finally {
    await page.context().close();
  }
});
test("real sync preserves reactions on API failure and removes stale reactions after confirmed empty response", async () => {
  const page = await pageFor("", "/messages/storage");
  try {
    await expect(page.getByRole("status")).toHaveText("Storage ready");
    await page.evaluate(() => (window as any).messagingStorage.seedReaction());
    await fail(page, "query:message_reactions");
    const rejected = await page.evaluate(async () => {
      try {
        await (window as any).messagingStorage.sync();
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(rejected, true);
    assert.equal(
      (await page.evaluate(() => (window as any).messagingStorage.reactions()))
        .length,
      1,
    );
    await page.evaluate(() => (window as any).messagingStorage.sync());
    assert.equal(
      (await page.evaluate(() => (window as any).messagingStorage.reactions()))
        .length,
      0,
    );
  } finally {
    await page.context().close();
  }
});
test("real encrypted outbox saves atomically, survives reload and duplicate retry preserves one message", async () => {
  const page = await pageFor("", "/messages/storage");
  try {
    await expect(page.getByRole("status")).toHaveText("Storage ready");
    const payload = await page.evaluate(() => ({
      id: crypto.randomUUID(),
      conversationId: (window as any).messagesFixture.dm,
      senderId: (window as any).messagesFixture.me,
      content: "A private queued message",
      messageType: "text",
    }));
    await page.evaluate(
      (payload) =>
        Promise.all([
          (window as any).messagingStorage.send(payload),
          (window as any).messagingStorage.send(payload),
        ]),
      payload,
    );
    let snapshot = await page.evaluate(() =>
      (window as any).messagingStorage.snapshot(),
    );
    assert.equal(snapshot.messages.length, 1);
    assert.equal(snapshot.queue.length, 1);
    assert.equal(snapshot.messages[0].sync_status, "pending");
    const created = snapshot.messages[0].created_at;
    const raw = await page.evaluate(async () => {
      const request = indexedDB.open("SerkleChatDB_v4");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const rows = db.transaction("messages").objectStore("messages").getAll();
      return await new Promise<any[]>((resolve, reject) => {
        rows.onsuccess = () => {
          db.close();
          resolve(rows.result);
        };
        rows.onerror = () => reject(rows.error);
      });
    });
    assert.ok(
      !JSON.stringify(raw).includes(payload.content),
      "Plaintext message content must not be stored on disk",
    );
    await page.reload();
    await expect(page.getByRole("status")).toHaveText("Storage ready");
    await page.evaluate(
      (payload) => (window as any).messagingStorage.send(payload),
      payload,
    );
    snapshot = await page.evaluate(() =>
      (window as any).messagingStorage.snapshot(),
    );
    assert.equal(snapshot.messages.length, 1);
    assert.equal(snapshot.queue.length, 1);
    assert.equal(snapshot.messages[0].created_at, created);
  } finally {
    await page.context().close();
  }
});
test("real unread hook counts incoming rows despite own latest message and persists read state across reload", async () => {
  const page = await pageFor("", "/messages/storage");
  try {
    await expect(page.getByRole("status")).toHaveText("Storage ready");
    await page.evaluate(() => (window as any).messagingStorage.seedUnread());
    await expect(page.getByTestId("storage-unread")).toHaveText("2");
    await page.evaluate(() => (window as any).messagingStorage.read());
    await expect(page.getByTestId("storage-unread")).toHaveText("0");
    await page.reload();
    await expect(page.getByRole("status")).toHaveText("Storage ready");
    await expect(page.getByTestId("storage-unread")).toHaveText("0");
  } finally {
    await page.context().close();
  }
});
test("delete failure keeps the dialog and message, and successful retry removes it", async () => {
  const page = await pageFor("", `/messages/${dm}`);
  try {
    await fail(page, "delete-everyone");
    const menu = await actions(page);
    await menu
      .getByRole("button", { name: "Delete message", exact: true })
      .click();
    const dialog = page.getByRole("alertdialog", {
      name: "Delete message?",
      exact: true,
    });
    await expect(
      dialog.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await dialog
      .getByRole("button", { name: "Delete for everyone", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      "could not be deleted",
    );
    assert.equal(
      await page.evaluate(
        () => (window as any).messagesFixture.messages().length,
      ),
      4,
    );
    await dialog
      .getByRole("button", { name: "Delete for everyone", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    assert.equal(
      await page.evaluate(
        () => (window as any).messagesFixture.messages().length,
      ),
      3,
    );
  } finally {
    await page.context().close();
  }
});
test("forwarding waits for confirmation and retries reuse the same destination message IDs", async () => {
  const page = await pageFor("", `/messages/${dm}`);
  try {
    await fail(page, "forward");
    const menu = await actions(page);
    await menu.getByRole("button", { name: "Forward", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Forward message",
      exact: true,
    });
    await dialog
      .getByRole("button", { name: "Creative Circle", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Forward to 1", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Creative Circle", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await dialog
      .getByRole("button", { name: "Forward to 1", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    const forwards = (await calls(page)).filter(
      (call) => call.name === "forward",
    );
    assert.equal(forwards.length, 2);
    assert.deepEqual(
      forwards[0].value.messageIds,
      forwards[1].value.messageIds,
    );
    await expect(page.getByTestId("current-path")).toHaveText(
      `/messages/${dm}`,
    );
  } finally {
    await page.context().close();
  }
});
test("failed edit retains text and reaction selection closes only after success", async () => {
  const page = await pageFor("", `/messages/${dm}`);
  try {
    await fail(page, "edit");
    let menu = await actions(page);
    await menu
      .getByRole("button", { name: "Edit message", exact: true })
      .click();
    const input = page.getByRole("textbox", {
      name: "Write a message",
      exact: true,
    });
    await input.fill("A revised plan");
    await page
      .getByRole("button", { name: "Save message edit", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Your text is still here",
    );
    await expect(input).toHaveValue("A revised plan");
    await page
      .getByRole("button", { name: "Save message edit", exact: true })
      .click();
    await expect(input).toHaveValue("");
    menu = await actions(page);
    await menu.getByRole("button", { name: "React", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "React to message",
      exact: true,
    });
    await fail(page, "reaction");
    await dialog.getByRole("button", { name: "Heart", exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(
      page.getByText("Reaction could not be saved. Please try again."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Heart", exact: true }).click();
    await expect(dialog).toBeHidden();
  } finally {
    await page.context().close();
  }
});
test("group creation retains failed selections and reuses its request ID without submitting from friend buttons", async () => {
  const page = await pageFor();
  try {
    await page.getByRole("button", { name: "New group", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New group", exact: true });
    await dialog
      .getByRole("textbox", { name: "Group name", exact: true })
      .fill("Weekend makers");
    await dialog.getByRole("button", { name: /Hana Tesfaye/ }).click();
    assert.equal(
      (await calls(page)).filter(
        (call) => call.name === "create_group_conversation",
      ).length,
      0,
    );
    await fail(page, "create_group_conversation");
    await dialog
      .getByRole("button", { name: "Create group", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: "Group name", exact: true }),
    ).toHaveValue("Weekend makers");
    await dialog
      .getByRole("button", { name: "Create group", exact: true })
      .click();
    const requests = (await calls(page)).filter(
      (call) => call.name === "create_group_conversation",
    );
    assert.equal(requests.length, 2);
    assert.equal(requests[0].value._request_id, requests[1].value._request_id);
    await expect(dialog).toBeHidden();
  } finally {
    await page.context().close();
  }
});
test("valid invitations require explicit join; expired and legacy links do not join", async () => {
  for (const scenario of ["", "invite-expired", "invite-member", "legacy"]) {
    const page = await pageFor(
      scenario,
      scenario === "legacy"
        ? `/messages?join_group=${group}`
        : "/messages?invite=20000000-0000-4000-8000-000000000001",
    );
    try {
      const dialog = page.getByRole("dialog", {
        name: "Group invitation",
        exact: true,
      });
      await expect(dialog).toBeVisible();
      if (scenario === "invite-expired" || scenario === "legacy") {
        await expect(dialog.getByRole("alert")).toContainText(
          "invalid, expired",
        );
        assert.equal(
          (await calls(page)).filter((call) => call.name === "join_chat_group")
            .length,
          0,
        );
      } else {
        const button = dialog.getByRole("button", {
          name: scenario === "invite-member" ? "Open group" : "Join group",
          exact: true,
        });
        await expect(button).toBeVisible();
        assert.equal(
          (await calls(page)).filter((call) => call.name === "join_chat_group")
            .length,
          0,
        );
        await button.click();
        await expect(page.getByTestId("current-path")).toHaveText(
          `/messages/${group}`,
        );
      }
    } finally {
      await page.context().close();
    }
  }
});
test("media upload failure retains preview and retry uses the existing upload and message ID", async () => {
  const page = await pageFor("", `/messages/${dm}`);
  try {
    await page
      .getByRole("button", { name: "Add attachment", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Add to your message",
      exact: true,
    });
    await dialog.getByLabel("Choose photo", { exact: true }).setInputFiles({
      name: "sample.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZioAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    const preview = page.getByRole("dialog", {
      name: "Preview attachments",
      exact: true,
    });
    await expect(preview).toBeVisible();
    await fail(page, "send");
    await preview
      .getByRole("textbox", { name: "Attachment caption", exact: true })
      .fill("A shared photo");
    await preview
      .getByRole("button", { name: "Send attachments", exact: true })
      .click();
    await expect(preview.getByRole("alert")).toBeVisible();
    await preview
      .getByRole("button", { name: "Retry attachments", exact: true })
      .click();
    await expect(preview).toBeHidden();
    const requests = await calls(page),
      sends = requests.filter((call) => call.name === "send");
    assert.equal(requests.filter((call) => call.name === "upload").length, 1);
    assert.equal(sends.length, 2);
    assert.equal(sends[0].value.id, sends[1].value.id);
  } finally {
    await page.context().close();
  }
});
test("loading, unknown counts, empty results, sync failure and unknown presence have honest states", async () => {
  for (const scenario of [
    "loading",
    "count-loading",
    "empty",
    "sync-error",
    "presence-unknown",
    "roles-error",
  ]) {
    const page = await pageFor(
      scenario,
      scenario === "presence-unknown"
        ? `/messages/${dm}`
        : scenario === "roles-error"
          ? `/messages/${group}`
          : "/messages",
    );
    try {
      if (scenario === "loading")
        await expect(page.getByRole("status").first()).toBeVisible();
      if (scenario === "count-loading")
        await expect(page.locator(".msg-inbox-header .msg-badge")).toHaveCount(
          0,
        );
      if (scenario === "empty")
        await expect(
          page.getByText("Start a conversation", { exact: true }),
        ).toBeVisible();
      if (scenario === "sync-error") {
        await expect(page.getByRole("alert")).toContainText(
          "couldn’t be refreshed",
        );
        await expect(
          page.getByText("Messages are up to date", { exact: true }),
        ).toHaveCount(0);
      }
      if (scenario === "presence-unknown")
        await expect(page.locator(".msg-chat-title")).toContainText(
          "Presence unavailable",
        );
      if (scenario === "roles-error") {
        await page
          .getByRole("button", { name: "Open group profile", exact: true })
          .click();
        const profile = page.getByRole("dialog", {
          name: "Group profile",
          exact: true,
        });
        await expect(
          profile.getByRole("button", { name: "Add members", exact: true }),
        ).toHaveCount(0);
        await expect(
          profile.getByRole("button", { name: "Invite", exact: true }),
        ).toHaveCount(0);
      }
    } finally {
      await page.context().close();
    }
  }
});
async function actions(page: Page, own = true) {
  await page
    .getByRole("button", {
      name: own ? "Actions for your message" : "Actions for incoming message",
    })
    .last()
    .click();
  return page.getByRole("dialog", { name: "Message actions", exact: true });
}
test("inbox shows positive unread counts even when latest sender is self, hides zero, filters and caps honestly", async () => {
  const page = await pageFor();
  try {
    await expect(
      page.getByRole("heading", { name: "Messages", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Hana Tesfaye, 3 unread messages",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId(`conversation-${dm}`)).toContainText("3");
    await expect(page.getByTestId(`conversation-${group}`)).toContainText("1");
    await page.getByRole("button", { name: /^Unread/ }).click();
    await expect(page.locator(".msg-conversation")).toHaveCount(2);
    await page.getByRole("button", { name: "Groups", exact: true }).click();
    await expect(page.locator(".msg-conversation")).toHaveCount(1);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.evaluate(() => (window as any).messagesFixture.setUnread(145));
    await expect(
      page.getByTestId(`conversation-${dm}`).locator(".msg-badge"),
    ).toHaveText("99+");
    await expect(
      page.getByRole("button", {
        name: "Hana Tesfaye, 145 unread messages",
        exact: true,
      }),
    ).toBeVisible();
    await page.evaluate(() => (window as any).messagesFixture.setUnread(3));
    await page.screenshot({ path: artifact + "/inbox-b.png" });
  } finally {
    await page.context().close();
  }
});
test("message draft survives failed save and repeated clicks submit once", async () => {
  const page = await pageFor("", `/messages/${dm}`);
  try {
    const input = page.getByRole("textbox", {
      name: "Write a message",
      exact: true,
    });
    await expect(input).toBeVisible();
    await fail(page, "send");
    await input.fill("Keep this draft");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .dblclick({ delay: 10 });
    await expect(page.getByRole("alert")).toContainText(
      "Your text is still here",
    );
    await expect(input).toHaveValue("Keep this draft");
    assert.equal(
      (await calls(page)).filter((call) => call.name === "send").length,
      1,
    );
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(input).toHaveValue("");
    assert.equal(
      (await calls(page)).filter((call) => call.name === "send").length,
      2,
    );
    await page.screenshot({ path: artifact + "/chat-b.png" });
  } finally {
    await page.context().close();
  }
});
test("contact profile retains neutral historical presence, separate media types and private-file retry", async () => {
  const page = await pageFor("media-failed", `/messages/${dm}`);
  try {
    await page
      .getByRole("button", { name: "Open contact profile", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Contact profile",
      exact: true,
    });
    await expect(dialog).toContainText("Last active 18 days ago");
    await expect(dialog).not.toContainText("Online");
    await expect(
      dialog.getByRole("button", { name: "Media 1", exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Files 1", exact: true }).click();
    await expect(dialog).toContainText("1 loaded item");
    await dialog
      .getByRole("button", { name: "Unavailable · Retry", exact: true })
      .click();
    assert.equal(
      (await calls(page)).filter((call) => call.name === "media-retry").length,
      1,
    );
    await dialog.getByRole("button", { name: "Media 1", exact: true }).click();
    await page.screenshot({ path: artifact + "/contact-b.png" });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Open contact profile", exact: true }),
    ).toBeFocused();
  } finally {
    await page.context().close();
  }
});
test("group owner can manage but cannot accidentally leave; member sees confirmation and failed leave retains access", async () => {
  for (const scenario of ["owner", "member"]) {
    const page = await pageFor(scenario, `/messages/${group}`);
    try {
      await expect(page.getByRole('textbox',{name:'Write a message',exact:true})).toBeInViewport();
      const composer=await page.locator('.msg-composer').boundingBox();
      assert.ok(composer&&composer.y+composer.height<=845,'Group composer remains in the viewport');
      await page.screenshot({ path: artifact + "/group-b.png" });
      await page
        .getByRole("button", { name: "Open group profile", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Group profile",
        exact: true,
      });
      await expect(dialog).toContainText("3 members");
      if (scenario === "owner") {
        await expect(dialog).toContainText("Transfer ownership");
        await expect(
          dialog.getByRole("button", { name: "Leave group", exact: true }),
        ).toHaveCount(0);
        await page.screenshot({ path: artifact + "/group-profile-b.png" });
      } else {
        await fail(page, "leave");
        await dialog
          .getByRole("button", { name: "Leave group", exact: true })
          .click();
        const confirm = page.getByRole("alertdialog");
        await confirm
          .getByRole("button", { name: "Leave group", exact: true })
          .click();
        await expect(confirm.getByRole("alert")).toBeVisible();
        await expect(page.getByTestId("current-path")).toHaveText(
          `/messages/${group}`,
        );
        await confirm
          .getByRole("button", { name: "Leave group", exact: true })
          .click();
        await expect(page.getByTestId("current-path")).toHaveText("/messages");
      }
    } finally {
      await page.context().close();
    }
  }
});
test("responsive layouts have no horizontal overflow at 320, 390 and desktop in both themes", async () => {
  for (const width of [320, 390, 1440])
    for (const dark of [false, true]) {
      const page = await pageFor("", `/messages/${dm}`, width, dark);
      try {
        await expect(
          page.getByRole("textbox", { name: "Write a message", exact: true }),
        ).toBeVisible();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          true,
          `${width} ${dark}`,
        );
        const composer = await page.locator(".msg-composer").boundingBox();
        assert.ok(
          composer && composer.y + composer.height <= 845,
          "Composer remains visible",
        );
        if (width === 1440) {
          await expect(page.locator(".msg-profile-panel")).toBeVisible();
          await page.screenshot({
            path: artifact + `/desktop-${dark ? "dark" : "light"}-b.png`,
          });
        }
      } finally {
        await page.context().close();
      }
    }
});
