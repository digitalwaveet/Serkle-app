import type { UserProfile } from "../types/user.ts";
const privacyFields = [
  "isPrivate",
  "hideFollowers",
  "hideOnlineStatus",
  "allowMessagesFrom",
];
export function isPrivacyUpdate(updates: Partial<UserProfile>) {
  const fields = Object.keys(updates);
  return (
    fields.length > 0 && fields.every((field) => privacyFields.includes(field))
  );
}
export function profileUpdatePayload(updates: Partial<UserProfile>) {
  return {
    ...(updates.name !== undefined && { name: updates.name }),
    ...(updates.username !== undefined && { username: updates.username }),
    ...(updates.email !== undefined && { email: updates.email }),
    ...(updates.bio !== undefined && { bio: updates.bio }),
    ...(updates.subtitle !== undefined && { subtitle: updates.subtitle }),
    ...(updates.location !== undefined && { location: updates.location }),
    ...(updates.website !== undefined && {
      website: Array.isArray(updates.website)
        ? updates.website[0]
        : updates.website,
    }),
    ...(updates.avatar !== undefined && { avatar_url: updates.avatar }),
    ...(updates.coverImage !== undefined && {
      cover_image_url: updates.coverImage,
    }),
    ...(updates.isPrivate !== undefined && { is_private: updates.isPrivate }),
    ...(updates.hideFollowers !== undefined && {
      hide_followers: updates.hideFollowers,
    }),
    ...(updates.hideOnlineStatus !== undefined && {
      hide_online_status: updates.hideOnlineStatus,
    }),
    ...(updates.allowMessagesFrom !== undefined && {
      allow_messages_from: updates.allowMessagesFrom,
    }),
  };
}
