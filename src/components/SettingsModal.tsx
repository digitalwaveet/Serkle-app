import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Radio from "@radix-ui/react-radio-group";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Check,
  Download,
  Eye,
  HardDrive,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Monitor,
  Moon,
  Phone,
  RefreshCw,
  Send,
  Settings,
  Shield,
  Smartphone,
  Sun,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { useAutoplaySettings } from "@/hooks/useAutoplaySettings";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { clearIDBCache } from "@/utils/queryPersister";
import {
  SettingsGroup,
  SettingsRow,
  SettingsToggle,
} from "./settings/SettingsParts";
import "./settings/settings.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement>;
}
type Section = "general" | "privacy" | "notifications" | "account" | "storage";
type PasswordStep =
  "idle" | "sending" | "code-sent" | "verifying" | "new-password" | "saving";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
const sections = {
  general: {
    label: "General",
    title: "Make Serkle yours",
    description: "Choose how Serkle looks and plays on this device.",
    Icon: Settings,
  },
  privacy: {
    label: "Privacy",
    title: "Your privacy, your choice",
    description: "Control your visibility and who can reach you.",
    Icon: Shield,
  },
  notifications: {
    label: "Notifications",
    title: "Stay in the loop",
    description: "Manage notifications and delivery on this device.",
    Icon: Bell,
  },
  account: {
    label: "Account & security",
    title: "Account & security",
    description: "Your sign-in details, verification and password.",
    Icon: KeyRound,
  },
  storage: {
    label: "Storage",
    title: "Space for what matters",
    description: "Review browser storage and manage cached app data.",
    Icon: HardDrive,
  },
};
const message = (error: unknown, fallback: string) =>
  error && typeof error === "object" && "message" in error
    ? String(error.message)
    : fallback;
const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  return local && domain
    ? `${local.slice(0, 1)}${"•".repeat(Math.min(Math.max(local.length - 2, 1), 6))}${local.length > 1 ? local.slice(-1) : ""}@${domain}`
    : "Not set";
};
const maskPhone = (phone: string) =>
  phone
    ? `${"•".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`
    : "Not set";
const bytes = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return "Unavailable";
  if (!value) return "0 B";
  const i = Math.min(3, Math.floor(Math.log(value) / Math.log(1024)));
  return `${Number((value / 1024 ** i).toFixed(1))} ${["B", "KB", "MB", "GB"][i]}`;
};

export default function SettingsModal({
  isOpen,
  onClose,
  returnFocusRef,
}: Props) {
  const { user, updateProfile } = useUser();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const ids = useId();
  const { autoplayEnabled, toggleAutoplay } = useAutoplaySettings();
  const push = usePushNotifications();
  const [section, setSection] = useState<Section>("general");
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [account, setAccount] = useState<{
    status: "loading" | "ready" | "error";
    email: string;
    phone: string;
    verified: boolean;
  }>({ status: "loading", email: "", phone: "", verified: false });
  const [storage, setStorage] = useState<{
    status: "loading" | "ready" | "error";
    used: number;
    quota: number;
  }>({ status: "loading", used: 0, quota: 0 });
  const [clearing, setClearing] = useState(false);
  const [confirm, setConfirm] = useState<"cache" | "push" | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIOS] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordStep, setPasswordStep] = useState<PasswordStep>("idle");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const accountOwner = useRef(user?.id);
  accountOwner.current = user?.id;
  const passwordOpener = useRef<HTMLElement | null>(null);
  const confirmOpener = useRef<HTMLElement | null>(null);
  const openConfirmation = (kind: "cache" | "push") => {
    confirmOpener.current = document.activeElement as HTMLElement;
    setConfirm(kind);
  };
  const loadAccount = useCallback(async () => {
    if (!user?.id) return;
    const owner = user.id;
    setAccount({ status: "loading", email: "", phone: "", verified: false });
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user || data.user.id !== owner)
        throw error || new Error("Account changed");
      if (accountOwner.current === owner)
        setAccount({
          status: "ready",
          email: data.user.email || "",
          phone: data.user.phone || "",
          verified: !!data.user.email_confirmed_at,
        });
    } catch {
      if (accountOwner.current === owner)
        setAccount({ status: "error", email: "", phone: "", verified: false });
    }
  }, [user?.id]);
  const loadStorage = useCallback(async () => {
    setStorage({ status: "loading", used: 0, quota: 0 });
    try {
      if (!navigator.storage?.estimate) throw new Error("Unavailable");
      const result = await navigator.storage.estimate();
      if (result.usage === undefined) throw new Error("Unavailable");
      setStorage({
        status: "ready",
        used: result.usage,
        quota: result.quota || 0,
      });
    } catch {
      setStorage({ status: "error", used: 0, quota: 0 });
    }
  }, []);
  useEffect(() => {
    if (isOpen) {
      void loadAccount();
      void loadStorage();
    }
  }, [isOpen, loadAccount, loadStorage]);
  useEffect(() => {
    setNotice(null);
  }, [section, user?.id]);
  useEffect(() => {
    setPasswordOpen(false);
    setPasswordStep("idle");
    setOtp("");
    setPassword("");
    setRepeat("");
    setPasswordError("");
  }, [user?.id, isOpen]);
  const enablePush = useCallback(async () => {
    setPushBusy(true);
    setNotice(null);
    try {
      const ok = await push.requestPermission();
      setNotice(
        ok
          ? {
              text: "Browser permission granted. Send a test to check delivery.",
            }
          : {
              text: "Notifications could not be enabled. Check browser permissions and try again.",
              error: true,
            },
      );
    } catch (error) {
      setNotice({
        text: message(error, "Notification setup failed. Please try again."),
        error: true,
      });
    } finally {
      setPushBusy(false);
    }
  }, [push.requestPermission]);
  useEffect(() => {
    if (!isOpen) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("view") !== "notifications") return;
    setSection("notifications");
    const resume = url.searchParams.get("action") === "resubscribe";
    url.searchParams.delete("view");
    url.searchParams.delete("action");
    window.history.replaceState(window.history.state, "", url.toString());
    const timer = resume
      ? setTimeout(() => {
          void enablePush();
        }, 1000)
      : undefined;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    const available = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  const save = async (
    field:
      "isPrivate" | "hideFollowers" | "hideOnlineStatus" | "allowMessagesFrom",
    value: boolean | string,
  ) => {
    if (saving) return;
    setSaving(field);
    setNotice(null);
    try {
      await updateProfile({ [field]: value } as any);
      setNotice({ text: "Settings saved." });
    } catch (error) {
      setNotice({
        text: message(error, "Could not save your setting. Please try again."),
        error: true,
      });
    } finally {
      setSaving(null);
    }
  };
  const clearCache = async () => {
    setClearing(true);
    setNotice(null);
    try {
      await clearIDBCache(true);
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
      setNotice({ text: "App cache cleared." });
      await loadStorage();
    } catch {
      setNotice({
        text: "Cache could not be fully cleared. Please try again.",
        error: true,
      });
    } finally {
      setClearing(false);
    }
  };
  const reconnect = async () => {
    setPushBusy(true);
    try {
      await push.unregisterServiceWorker();
      const url = new URL(window.location.href);
      url.searchParams.set("view", "notifications");
      url.searchParams.set("action", "resubscribe");
      window.location.href = url.toString();
    } catch (error) {
      setNotice({
        text: message(error, "Device could not be reconnected."),
        error: true,
      });
      setPushBusy(false);
    }
  };
  const resetPasswordDialog = () => {
    setPasswordOpen(false);
    setPasswordStep("idle");
    setOtp("");
    setPassword("");
    setRepeat("");
    setPasswordError("");
  };
  const sendRecovery = async () => {
    if (!account.email || passwordStep === "sending") return;
    setPasswordStep("sending");
    setPasswordError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        account.email,
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (error) throw error;
      setPasswordStep("code-sent");
    } catch (error) {
      setPasswordError(message(error, "Recovery email could not be sent."));
      setPasswordStep("idle");
    }
  };
  const verifyCode = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setPasswordError("Enter the 6-digit recovery code.");
      return;
    }
    if (passwordStep === "verifying") return;
    setPasswordStep("verifying");
    setPasswordError("");
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: account.email,
        token: otp,
        type: "recovery",
      });
      if (error) throw error;
      setPasswordStep("new-password");
    } catch (error) {
      setPasswordError(message(error, "Invalid or expired code."));
      setPasswordStep("code-sent");
    }
  };
  const updatePassword = async () => {
    if (passwordStep === "saving") return;
    if (password.length < 6) {
      setPasswordError("Use at least 6 characters.");
      return;
    }
    if (password !== repeat) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setPasswordStep("saving");
    setPasswordError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      resetPasswordDialog();
      setNotice({ text: "Password updated." });
    } catch (error) {
      setPasswordError(message(error, "Password could not be updated."));
      setPasswordStep("new-password");
    }
  };
  const resend = async () => {
    setVerifyingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: account.email,
      });
      if (error) throw error;
      setNotice({ text: "Verification email requested. Check your inbox." });
    } catch (error) {
      setNotice({
        text: message(error, "Verification email could not be sent."),
        error: true,
      });
    } finally {
      setVerifyingEmail(false);
    }
  };
  const logout = async () => {
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/login", { replace: true });
    } catch (error) {
      setNotice({
        text: message(error, "Could not log out. Please try again."),
        error: true,
      });
      setLoggingOut(false);
    }
  };
  if (!user) return null;
  const selected = sections[section];
  const percentage =
    storage.quota > 0
      ? Math.min(100, Math.max(0, (storage.used / storage.quota) * 100))
      : null;
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Content
          className="settings-ui settings-screen"
          aria-describedby={`${ids}-description`}
          onCloseAutoFocus={(event) => {
            if (returnFocusRef?.current) {
              event.preventDefault();
              returnFocusRef.current.focus();
            }
          }}
        >
          <header className="settings-header">
            <div className="settings-header-inner">
              <button
                className="settings-icon-button"
                aria-label={
                  section === "general"
                    ? "Back, close settings"
                    : "Back to general settings"
                }
                onClick={() =>
                  section === "general" ? onClose() : setSection("general")
                }
              >
                <ArrowLeft aria-hidden="true" />
              </button>
              <div className="settings-header-brand">
                <img src="/lovable-uploads/SerkleMainLogo.svg" alt="" />
                <div>
                  <Dialog.Title asChild>
                    <h1>Settings</h1>
                  </Dialog.Title>
                  <Dialog.Description id={`${ids}-description`} asChild>
                    <p>Your Serkle, your way</p>
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close
                className="settings-icon-button"
                aria-label="Close settings"
              >
                <X aria-hidden="true" />
              </Dialog.Close>
            </div>
          </header>
          <div className="settings-scroll">
            <div className="settings-layout">
              <aside className="settings-sidebar">
                <div className="settings-account">
                  <span className="settings-account-avatar">
                    {user.initials}
                  </span>
                  <div>
                    <strong>{user.name}</strong>
                    <p>@{user.username}</p>
                  </div>
                </div>
                <nav className="settings-nav" aria-label="Settings categories">
                  {(Object.keys(sections) as Section[]).map((key) => {
                    const item = sections[key];
                    return (
                      <button
                        key={key}
                        aria-current={section === key ? "page" : undefined}
                        onClick={() => setSection(key)}
                      >
                        <item.Icon aria-hidden="true" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
                <p className="settings-sidebar-note">
                  Make yourself at home.
                  <br />
                  Manage your experience, privacy and account.
                </p>
              </aside>
              <section
                className="settings-main"
                aria-labelledby={`${ids}-section`}
              >
                <div className="settings-heading">
                  <h2 id={`${ids}-section`}>{selected.title}</h2>
                  <p>{selected.description}</p>
                </div>
                {notice && (
                  <div
                    role={notice.error ? "alert" : "status"}
                    className={`settings-note ${notice.error ? "settings-note--danger" : "settings-note--saved"}`}
                  >
                    <Info aria-hidden="true" />
                    <span>{notice.text}</span>
                  </div>
                )}
                <div className="settings-panel" key={section}>
                  {section === "general" && (
                    <>
                      <SettingsGroup title="Appearance">
                        <div className="settings-card--padded">
                          <p
                            className="mb-4 text-sm"
                            style={{ color: "hsl(var(--settings-muted))" }}
                          >
                            Choose a theme, or follow your device.
                          </p>
                          <Radio.Root
                            value={theme}
                            onValueChange={(value) =>
                              setTheme(value as "light" | "dark" | "system")
                            }
                            className="settings-theme-group"
                            aria-label="Appearance"
                          >
                            {(
                              [
                                { value: "light", label: "Light", Icon: Sun },
                                { value: "dark", label: "Dark", Icon: Moon },
                                {
                                  value: "system",
                                  label: "System",
                                  Icon: Monitor,
                                },
                              ] as const
                            ).map(({ value, label, Icon }) => (
                              <Radio.Item
                                className="settings-theme"
                                key={value}
                                value={value}
                              >
                                <Icon aria-hidden="true" />
                                <span>{label}</span>
                                <Radio.Indicator className="settings-theme-check">
                                  <Check aria-hidden="true" />
                                </Radio.Indicator>
                              </Radio.Item>
                            ))}
                          </Radio.Root>
                        </div>
                      </SettingsGroup>
                      <SettingsGroup title="Media">
                        <SettingsToggle
                          icon={Video}
                          label="Autoplay videos"
                          description="Automatically play videos in feeds and Relax."
                          checked={autoplayEnabled}
                          onChange={toggleAutoplay}
                        />
                      </SettingsGroup>
                      <SettingsGroup title="Serkle on your device">
                        <SettingsRow
                          icon={Smartphone}
                          label="Install the Serkle app"
                          description={
                            installed
                              ? "Installed on this device."
                              : isIOS
                                ? "In Safari, tap Share, then Add to Home Screen."
                                : "Keep Serkle close with a home screen shortcut."
                          }
                        />
                        {!installed && (
                          <div className="px-6 pb-6">
                            {!isIOS && (
                              <button
                                className="settings-button settings-button--secondary w-full"
                                disabled={!installPrompt}
                                onClick={async () => {
                                  if (!installPrompt) return;
                                  try {
                                    await installPrompt.prompt();
                                    const choice =
                                      await installPrompt.userChoice;
                                    setNotice({
                                      text:
                                        choice.outcome === "accepted"
                                          ? "Installation requested. Follow your browser’s instructions."
                                          : "Installation was not completed.",
                                    });
                                    setInstallPrompt(null);
                                  } catch {
                                    setNotice({
                                      text: "Installation could not be started.",
                                      error: true,
                                    });
                                  }
                                }}
                              >
                                <Download aria-hidden="true" />
                                {installPrompt
                                  ? "Install now"
                                  : "Install from your browser menu"}
                              </button>
                            )}
                            <p
                              className="mt-3 text-xs"
                              style={{ color: "hsl(var(--settings-muted))" }}
                            >
                              {isIOS
                                ? "Choose Add to Home Screen from Safari’s Share menu."
                                : "If an install prompt is unavailable, check your browser’s install or home screen menu."}
                            </p>
                          </div>
                        )}
                      </SettingsGroup>
                    </>
                  )}
                  {section === "privacy" && (
                    <>
                      <SettingsGroup title="Account visibility">
                        <SettingsToggle
                          icon={Lock}
                          label="Private account"
                          description="Only followers can see your posts and videos."
                          checked={user.isPrivate}
                          onChange={(value) => void save("isPrivate", value)}
                          disabled={!!saving}
                          busy={saving === "isPrivate"}
                        />
                        <SettingsToggle
                          icon={Eye}
                          label="Hide follower counts"
                          description="Hide your follower and following counts from others."
                          checked={user.hideFollowers}
                          onChange={(value) =>
                            void save("hideFollowers", value)
                          }
                          disabled={!!saving}
                          busy={saving === "hideFollowers"}
                        />
                        <SettingsToggle
                          icon={Shield}
                          label="Hide online status"
                          description="Keep your online status private."
                          checked={user.hideOnlineStatus}
                          onChange={(value) =>
                            void save("hideOnlineStatus", value)
                          }
                          disabled={!!saving}
                          busy={saving === "hideOnlineStatus"}
                        />
                      </SettingsGroup>
                      <SettingsGroup title="Messages">
                        <SettingsRow
                          icon={MessageCircle}
                          label="Allow messages from"
                          description="Choose who can send you messages."
                          stack
                        >
                          <div className="settings-field">
                            <select
                              aria-label="Allow messages from"
                              value={user.allowMessagesFrom}
                              onChange={(event) =>
                                void save(
                                  "allowMessagesFrom",
                                  event.target.value,
                                )
                              }
                              disabled={!!saving}
                            >
                              <option value="everyone">Everyone</option>
                              <option value="followers">Followers</option>
                              <option value="nobody">Nobody</option>
                            </select>
                            {saving === "allowMessagesFrom" && (
                              <SerkleLoader
                                size="xs"
                                label="Saving message preference"
                              />
                            )}
                          </div>
                        </SettingsRow>
                      </SettingsGroup>
                    </>
                  )}
                  {section === "notifications" && (
                    <>
                      <SettingsGroup title="Push notifications">
                        <div className="settings-status-card">
                          <span className="settings-status-icon">
                            <Bell aria-hidden="true" />
                          </span>
                          <h3>
                            {!push.isSupported
                              ? "Not supported here"
                              : push.permission === "denied"
                                ? "Notifications are blocked"
                                : push.permission === "granted"
                                  ? "Notifications are allowed"
                                  : "Keep up with your circle"}
                          </h3>
                          <p>
                            {!push.isSupported
                              ? "This browser or device does not support push notifications."
                              : push.permission === "denied"
                                ? "Open your browser’s site settings to allow notifications for Serkle."
                                : push.permission === "granted"
                                  ? "Browser permission is granted. You can test delivery to this device."
                                  : "Get messages and alerts without keeping Serkle open."}
                          </p>
                          {push.isSupported && (
                            <button
                              className="settings-button settings-button--primary w-full"
                              disabled={
                                pushBusy || push.permission === "denied"
                              }
                              onClick={() => {
                                if (push.permission === "granted") {
                                  setPushBusy(true);
                                  void push
                                    .sendTestNotification()
                                    .finally(() => setPushBusy(false));
                                } else void enablePush();
                              }}
                            >
                              {pushBusy ? (
                                <SerkleLoader
                                  size="xs"
                                  className="text-current"
                                  label="Updating notifications"
                                />
                              ) : push.permission === "granted" ? (
                                <Send aria-hidden="true" />
                              ) : (
                                <Bell aria-hidden="true" />
                              )}
                              {push.permission === "granted"
                                ? "Send test notification"
                                : "Enable notifications"}
                            </button>
                          )}
                        </div>
                      </SettingsGroup>
                      <SettingsGroup title="Connection & permissions">
                        <SettingsRow
                          icon={Shield}
                          label="Browser permission"
                          description={
                            !push.isSupported
                              ? "Unavailable"
                              : push.permission === "granted"
                                ? "Allowed"
                                : push.permission === "denied"
                                  ? "Blocked"
                                  : "Not requested"
                          }
                        />
                        <div className="settings-card--padded border-t border-border">
                          <h3 className="font-semibold mb-2">
                            Not receiving alerts?
                          </h3>
                          <p
                            className="text-sm mb-4"
                            style={{ color: "hsl(var(--settings-muted))" }}
                          >
                            Reconnect this device to reset its notification
                            registration. Serkle will reload.
                          </p>
                          <button
                            className="settings-button settings-button--secondary"
                            disabled={
                              pushBusy ||
                              !push.isSupported ||
                              push.permission === "denied"
                            }
                            onClick={() => openConfirmation("push")}
                          >
                            <RefreshCw aria-hidden="true" />
                            Force re-enable
                          </button>
                        </div>
                      </SettingsGroup>
                    </>
                  )}
                  {section === "account" && (
                    <>
                      <SettingsGroup title="Sign-in details">
                        {account.status === "loading" ? (
                          <div className="settings-card--padded">
                            <SerkleLoader
                              label="Loading account details"
                              showText
                            />
                          </div>
                        ) : account.status === "error" ? (
                          <div className="settings-card--padded">
                            <p role="alert" className="mb-3">
                              Account details could not be loaded.
                            </p>
                            <button
                              className="settings-button settings-button--secondary"
                              onClick={() => void loadAccount()}
                            >
                              Retry account details
                            </button>
                          </div>
                        ) : (
                          <>
                            <SettingsRow
                              icon={Mail}
                              label="Email address"
                              description={maskEmail(account.email)}
                              stack={!account.verified}
                            >
                              {!account.email ? (
                                <button
                                  className="settings-button settings-button--secondary"
                                  onClick={() => {
                                    onClose();
                                    navigate("/email-address");
                                  }}
                                >
                                  Enter email
                                </button>
                              ) : account.verified ? (
                                <span className="settings-badge">
                                  <BadgeCheck aria-hidden="true" />
                                  Verified
                                </span>
                              ) : (
                                <button
                                  className="settings-button settings-button--secondary"
                                  disabled={verifyingEmail}
                                  onClick={() => void resend()}
                                >
                                  {verifyingEmail ? (
                                    <SerkleLoader
                                      size="xs"
                                      label="Sending verification"
                                    />
                                  ) : (
                                    "Verify email"
                                  )}
                                </button>
                              )}
                            </SettingsRow>
                            <SettingsRow
                              icon={Phone}
                              label="Phone number"
                              description={maskPhone(account.phone)}
                            />
                          </>
                        )}
                      </SettingsGroup>
                      <SettingsGroup title="Password">
                        <div className="settings-card--padded">
                          <h3 className="font-semibold">Change password</h3>
                          <p
                            className="mt-2 mb-5 text-sm"
                            style={{ color: "hsl(var(--settings-muted))" }}
                          >
                            We’ll send recovery instructions to your account
                            email.
                          </p>
                          <button
                            className="settings-button settings-button--primary"
                            disabled={
                              account.status !== "ready" || !account.email
                            }
                            onClick={() => {
                              passwordOpener.current =
                                document.activeElement as HTMLElement;
                              setPasswordOpen(true);
                            }}
                          >
                            <KeyRound aria-hidden="true" />
                            Change password
                          </button>
                        </div>
                      </SettingsGroup>
                    </>
                  )}
                  {section === "storage" && (
                    <SettingsGroup title="Browser storage">
                      <div className="settings-card--padded">
                        {storage.status === "loading" ? (
                          <SerkleLoader label="Calculating storage" showText />
                        ) : storage.status === "error" ? (
                          <>
                            <p role="status" className="mb-4">
                              Storage usage is unavailable in this browser.
                            </p>
                            <button
                              className="settings-button settings-button--secondary"
                              onClick={() => void loadStorage()}
                            >
                              Retry storage estimate
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="settings-data">
                              <strong>{bytes(storage.used)}</strong>
                              <span>
                                {storage.quota > 0
                                  ? `of ${bytes(storage.quota)} browser allowance`
                                  : "Storage limit not reported"}
                              </span>
                            </div>
                            {percentage !== null && (
                              <div
                                className="settings-progress"
                                role="progressbar"
                                aria-label="Device storage usage"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(percentage)}
                              >
                                <span style={{ width: `${percentage}%` }} />
                              </div>
                            )}
                          </>
                        )}
                        <p className="settings-storage-help">
                          This is an estimate of Serkle’s storage on this
                          browser. Clearing app cache does not delete your
                          account settings or offline messages.
                        </p>
                        <button
                          className="settings-button settings-button--secondary w-full"
                          disabled={clearing}
                          onClick={() => openConfirmation("cache")}
                        >
                          {clearing ? (
                            <SerkleLoader
                              size="xs"
                              label="Clearing app cache"
                            />
                          ) : (
                            <Trash2 aria-hidden="true" />
                          )}
                          Clear cache
                        </button>
                      </div>
                    </SettingsGroup>
                  )}
                </div>
                <footer className="settings-footer">
                  <button
                    className="settings-button settings-button--danger"
                    onClick={() => void logout()}
                    disabled={loggingOut}
                  >
                    {loggingOut ? (
                      <SerkleLoader size="xs" label="Logging out" />
                    ) : (
                      <LogOut aria-hidden="true" />
                    )}
                    Log out
                  </button>
                </footer>
              </section>
            </div>
          </div>
          <Dialog.Root
            open={passwordOpen}
            onOpenChange={(open) => {
              if (!open) resetPasswordDialog();
            }}
          >
            <Dialog.Portal>
              <Dialog.Overlay className="settings-overlay" />
              <Dialog.Content
                className="settings-ui settings-dialog"
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  passwordOpener.current?.focus();
                }}
              >
                <header className="settings-dialog-header">
                  <Dialog.Title>Change password</Dialog.Title>
                  <Dialog.Close
                    className="settings-icon-button"
                    aria-label="Close password dialog"
                  >
                    <X aria-hidden="true" />
                  </Dialog.Close>
                </header>
                <div className="settings-dialog-body">
                  <Dialog.Description>
                    {passwordStep === "idle" || passwordStep === "sending"
                      ? `Send recovery instructions to ${maskEmail(account.email)}.`
                      : passwordStep === "code-sent" ||
                          passwordStep === "verifying"
                        ? "Use the recovery code from your email. If it contains a link, open that link to continue."
                        : "Choose your new password."}
                  </Dialog.Description>
                  {(passwordStep === "idle" || passwordStep === "sending") && (
                    <button
                      className="settings-button settings-button--primary w-full"
                      disabled={passwordStep === "sending"}
                      onClick={() => void sendRecovery()}
                    >
                      {passwordStep === "sending" ? (
                        <SerkleLoader
                          size="xs"
                          className="text-current"
                          label="Sending recovery email"
                        />
                      ) : (
                        <Mail aria-hidden="true" />
                      )}
                      Send recovery email
                    </button>
                  )}
                  {(passwordStep === "code-sent" ||
                    passwordStep === "verifying") && (
                    <form
                      className="space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void verifyCode();
                      }}
                    >
                      <div className="settings-field">
                        <label htmlFor={`${ids}-code`}>Recovery code</label>
                        <Input
                          id={`${ids}-code`}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="Enter 6-digit code"
                          value={otp}
                          onChange={(event) => {
                            setOtp(event.target.value);
                            setPasswordError("");
                          }}
                          aria-invalid={!!passwordError}
                          aria-describedby={
                            passwordError ? `${ids}-password-error` : undefined
                          }
                        />
                      </div>
                      <button
                        className="settings-button settings-button--primary w-full"
                        disabled={
                          passwordStep === "verifying" || otp.length !== 6
                        }
                      >
                        {passwordStep === "verifying" ? (
                          <SerkleLoader
                            size="xs"
                            className="text-current"
                            label="Verifying recovery code"
                          />
                        ) : (
                          "Verify code"
                        )}
                      </button>
                      <button
                        className="settings-button settings-button--quiet w-full"
                        type="button"
                        onClick={() => void sendRecovery()}
                      >
                        Resend recovery email
                      </button>
                    </form>
                  )}
                  {(passwordStep === "new-password" ||
                    passwordStep === "saving") && (
                    <form
                      className="space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void updatePassword();
                      }}
                    >
                      <div className="settings-field">
                        <label htmlFor={`${ids}-password`}>New password</label>
                        <Input
                          id={`${ids}-password`}
                          type="password"
                          autoComplete="new-password"
                          value={password}
                          onChange={(event) => {
                            setPassword(event.target.value);
                            setPasswordError("");
                          }}
                          aria-invalid={!!passwordError}
                          aria-describedby={
                            passwordError ? `${ids}-password-error` : undefined
                          }
                        />
                      </div>
                      <div className="settings-field">
                        <label htmlFor={`${ids}-repeat`}>
                          Confirm password
                        </label>
                        <Input
                          id={`${ids}-repeat`}
                          type="password"
                          autoComplete="new-password"
                          value={repeat}
                          onChange={(event) => {
                            setRepeat(event.target.value);
                            setPasswordError("");
                          }}
                          aria-invalid={!!passwordError}
                        />
                      </div>
                      <button
                        className="settings-button settings-button--primary w-full"
                        disabled={passwordStep === "saving"}
                      >
                        {passwordStep === "saving" ? (
                          <SerkleLoader
                            size="xs"
                            className="text-current"
                            label="Saving password"
                          />
                        ) : (
                          "Update password"
                        )}
                      </button>
                    </form>
                  )}
                  {passwordError && (
                    <p
                      id={`${ids}-password-error`}
                      role="alert"
                      className="settings-note settings-note--danger mt-4"
                    >
                      {passwordError}
                    </p>
                  )}
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <AlertDialog.Root
            open={!!confirm}
            onOpenChange={(open) => {
              if (!open) setConfirm(null);
            }}
          >
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="settings-overlay" />
              <AlertDialog.Content
                className="settings-ui settings-dialog"
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  confirmOpener.current?.focus();
                }}
              >
                <header className="settings-dialog-header">
                  <AlertDialog.Title>
                    {confirm === "cache"
                      ? "Clear app cache?"
                      : "Reconnect notifications?"}
                  </AlertDialog.Title>
                </header>
                <div className="settings-dialog-body">
                  <AlertDialog.Description>
                    {confirm === "cache"
                      ? "Cached pages and media will be downloaded again. Your account settings and offline messages will not be deleted."
                      : "This resets the notification connection and reloads Serkle. Browser permission is still required."}
                  </AlertDialog.Description>
                  <div className="settings-dialog-actions">
                    <AlertDialog.Cancel className="settings-button settings-button--secondary">
                      Cancel
                    </AlertDialog.Cancel>
                    <AlertDialog.Action
                      className="settings-button settings-button--primary"
                      onClick={() => {
                        const action = confirm;
                        setConfirm(null);
                        if (action === "cache") void clearCache();
                        else void reconnect();
                      }}
                    >
                      {confirm === "cache"
                        ? "Clear app cache"
                        : "Reconnect device"}
                    </AlertDialog.Action>
                  </div>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
