import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPrivacyUpdate,
  profileUpdatePayload,
} from "../lib/profileUpdates.ts";

test("privacy settings map to existing database columns, including false values", () => {
  assert.deepEqual(
    profileUpdatePayload({
      isPrivate: false,
      hideFollowers: true,
      hideOnlineStatus: false,
      allowMessagesFrom: "nobody",
    }),
    {
      is_private: false,
      hide_followers: true,
      hide_online_status: false,
      allow_messages_from: "nobody",
    },
  );
  assert.deepEqual(profileUpdatePayload({ allowMessagesFrom: "followers" }), {
    allow_messages_from: "followers",
  });
});
test("ordinary profile updates retain their previous column mapping", () => {
  assert.deepEqual(
    profileUpdatePayload({
      name: "Hana",
      username: "hana",
      email: "hana@example.test",
      bio: "Hello",
      subtitle: "Creator",
      location: "Addis",
      website: ["https://example.test"],
      avatar: "avatar.png",
      coverImage: "cover.png",
    }),
    {
      name: "Hana",
      username: "hana",
      email: "hana@example.test",
      bio: "Hello",
      subtitle: "Creator",
      location: "Addis",
      website: "https://example.test",
      avatar_url: "avatar.png",
      cover_image_url: "cover.png",
    },
  );
  assert.deepEqual(profileUpdatePayload({ website: "https://example.test" }), {
    website: "https://example.test",
  });
});
test("updates contain only supplied editable fields and exclude privilege flags", () => {
  assert.deepEqual(profileUpdatePayload({}), {});
  assert.deepEqual(
    profileUpdatePayload({
      id: "another-user",
      isVerified: true,
      isOnline: true,
    }),
    {},
  );
  assert.deepEqual(
    profileUpdatePayload({ isPrivate: undefined, hideFollowers: false }),
    { hide_followers: false },
  );
});
test("only privacy-only saves bypass the global profile loading state", () => {
  assert.equal(isPrivacyUpdate({ isPrivate: false }), true);
  assert.equal(
    isPrivacyUpdate({
      hideFollowers: true,
      hideOnlineStatus: true,
      allowMessagesFrom: "everyone",
    }),
    true,
  );
  assert.equal(isPrivacyUpdate({}), false);
  assert.equal(isPrivacyUpdate({ name: "Hana" }), false);
  assert.equal(isPrivacyUpdate({ isPrivate: true, name: "Hana" }), false);
});
