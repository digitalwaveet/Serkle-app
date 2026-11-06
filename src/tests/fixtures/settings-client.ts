import { useSyncExternalStore } from "react";
import { profileUpdatePayload } from "@/lib/profileUpdates";
const state = localStorage.getItem("settings-scenario") || "";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export const fixture = {
  user: JSON.parse(localStorage.getItem("settings-user") || "null") || {
    id: "fixture-user",
    name: "Hana Tesfaye",
    username: "hana",
    initials: "HT",
    avatar: "",
    isPrivate: false,
    hideFollowers: false,
    hideOnlineStatus: false,
    allowMessagesFrom: "everyone",
  },
  calls: [] as Array<{ name: string; value?: any }>,
  permission: (state === "denied"
    ? "denied"
    : state === "granted"
      ? "granted"
      : "default") as NotificationPermission,
};
(window as any).settingsFixture = fixture;
export function useUser() {
  const user = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => fixture.user,
  );
  return {
    user,
    updateProfile: async (value: any) => {
      fixture.calls.push({
        name: "profile",
        value: profileUpdatePayload(value),
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (state === "save-error") throw new Error("Fixture save failed");
      fixture.user = { ...fixture.user, ...value };
      localStorage.setItem("settings-user", JSON.stringify(fixture.user));
      notify();
    },
  };
}
const authCall = async (name: string, value?: any) => {
  fixture.calls.push({ name, value });
  return { error: null };
};
export const supabase = {
  auth: {
    getUser: async () =>
      state === "account-error"
        ? { data: { user: null }, error: new Error("Account unavailable") }
        : {
            data: {
              user: {
                id: "fixture-user",
                email: state === "no-email" ? "" : "hana@example.test",
                phone: "251911234567",
                email_confirmed_at:
                  state === "unverified" ? null : "2026-11-06T10:00:00Z",
              },
            },
            error: null,
          },
    resetPasswordForEmail: (email: string, options: any) =>
      authCall("reset-password", { email, options }),
    verifyOtp: async (value: any) =>
      value.token === "000000"
        ? { error: new Error("Invalid or expired code") }
        : authCall("verify-code", value),
    updateUser: (value: any) => authCall("update-user", value),
    resend: (value: any) => authCall("resend", value),
    signOut: () => authCall("sign-out"),
  },
  from: () => ({
    update: (value: any) => ({
      eq: async () => {
        fixture.calls.push({ name: "legacy-profile-write", value });
        return { error: null };
      },
    }),
  }),
};
export function usePushNotifications() {
  const permission = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => fixture.permission,
  );
  return {
    permission,
    isSupported: state !== "unsupported",
    subscription: permission === "granted" ? { endpoint: "fixture" } : null,
    requestPermission: async () => {
      fixture.calls.push({ name: "push-enable" });
      fixture.permission = "granted";
      notify();
      return true;
    },
    sendTestNotification: async () => {
      fixture.calls.push({ name: "push-test" });
      return true;
    },
    unregisterServiceWorker: async () => {
      fixture.calls.push({ name: "push-reset" });
      localStorage.setItem("push-reset-recorded", "true");
    },
  };
}
export const clearIDBCache = async () => {
  fixture.calls.push({ name: "clear-query-cache" });
  if (state === "cache-error") throw new Error("Fixture cache unavailable");
};
