import React, {
  useId,
  useRef,
  useState,
  type RefObject,
  type ElementType,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Bell,
  Volume2,
  Heart,
  Users,
  ShoppingBag,
  MessageSquare,
  ShieldAlert,
  X,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import {
  useNotificationPreferences,
  type NotificationPreferences,
} from "@/hooks/useNotificationPreferences";
import { Switch } from "@/components/ui/switch";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
import "./notification-panel.css";
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLElement>;
}
type Preference = keyof NotificationPreferences;
const groups: Array<{
  title: string;
  Icon: ElementType;
  items: Array<{
    key: Preference;
    label: string;
    description: string;
    readOnly?: boolean;
  }>;
}> = [
  {
    title: "Sound & banners",
    Icon: Volume2,
    items: [
      {
        key: "sound_enabled",
        label: "Sound effects",
        description: "Play a sound when a new notification arrives.",
      },
      {
        key: "in_app_toasts",
        label: "In-app banners",
        description: "Show a banner while you’re using Serkle.",
      },
    ],
  },
  {
    title: "Social activity",
    Icon: Heart,
    items: [
      {
        key: "social_likes",
        label: "Likes & reactions",
        description: "When someone appreciates your posts or videos.",
      },
      {
        key: "social_comments",
        label: "Comments & replies",
        description: "Conversations on your posts and videos.",
      },
      {
        key: "social_follows",
        label: "New followers",
        description: "When someone starts following you.",
      },
      {
        key: "social_mentions",
        label: "Mentions & tags",
        description: "When someone tags you in a post or story.",
      },
    ],
  },
  {
    title: "Circles & communities",
    Icon: Users,
    items: [
      {
        key: "circles_posts",
        label: "Circle posts",
        description: "New posts in Circles you’ve joined.",
      },
      {
        key: "circles_events",
        label: "Circle events",
        description: "Upcoming events and calendar updates.",
      },
    ],
  },
  {
    title: "Shop & orders",
    Icon: ShoppingBag,
    items: [
      {
        key: "shop_orders",
        label: "Order updates & shipping",
        description: "Confirmations, tracking and delivery updates.",
      },
      {
        key: "shop_disputes",
        label: "Disputes & resolution",
        description: "Updates about your order disputes.",
      },
    ],
  },
  {
    title: "Messages",
    Icon: MessageSquare,
    items: [
      {
        key: "messages_direct",
        label: "Direct messages",
        description: "When someone sends you a private message.",
      },
      {
        key: "messages_groups",
        label: "Group chats",
        description: "Messages in your group conversations.",
      },
    ],
  },
  {
    title: "Safety & support",
    Icon: ShieldAlert,
    items: [
      {
        key: "sos_alerts",
        label: "SOS community alerts",
        description:
          "Distress broadcasts near you. Managed in safety settings.",
        readOnly: true,
      },
      {
        key: "helper_responses",
        label: "Helper responses",
        description: "When members respond to safety requests.",
      },
    ],
  },
];
function PreferenceRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="notification-preference">
      <div className="notification-preference-copy">
        <label htmlFor={id}>{label}</label>
        <p id={`${id}-description`}>{description}</p>
      </div>
      <label className="notification-switch-target">
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
          aria-describedby={`${id}-description`}
        />
      </label>
    </div>
  );
}
export default function NotificationSettingsModal({
  open,
  onOpenChange,
  returnFocusRef,
}: Props) {
  const { user } = useUser();
  const { preferences, isLoading, error, refetch, updatePreferences } =
    useNotificationPreferences(user?.id);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const toggle = async (key: Preference, value: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setNotice(null);
    try {
      await updatePreferences.mutateAsync({ [key]: value });
      setNotice({ text: "Preference saved." });
    } catch {
      setNotice({
        text: "This preference could not be saved. Please try again.",
        error: true,
      });
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="notification-preferences-overlay" />
        <Dialog.Content
          className="notification-ui notification-preferences"
          onOpenAutoFocus={() => {
            opener.current =
              returnFocusRef?.current ||
              (document.activeElement as HTMLElement);
            setNotice(null);
          }}
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
        >
          <header className="notification-preferences-header">
            <span className="notification-heading-icon">
              <Bell aria-hidden="true" />
            </span>
            <div className="notification-heading-copy">
              <Dialog.Title>Notification preferences</Dialog.Title>
              <Dialog.Description>
                Choose the updates that matter to you.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="notification-icon-button"
              aria-label="Close notification preferences"
            >
              <X aria-hidden="true" />
            </Dialog.Close>
          </header>
          <div className="notification-preferences-body" aria-busy={saving}>
            {notice && (
              <div
                className={`notification-notice${notice.error ? " notification-notice--error" : ""}`}
                role={notice.error ? "alert" : "status"}
              >
                {notice.text}
              </div>
            )}
            {isLoading ? (
              <div className="notification-state">
                <SerkleLoader
                  size="sm"
                  label="Loading notification preferences"
                  showText
                />
              </div>
            ) : error || !preferences ? (
              <div className="notification-state">
                <h3>Preferences unavailable</h3>
                <p>Your saved choices could not be loaded.</p>
                <button
                  className="notification-button"
                  onClick={() => void refetch()}
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                <section
                  className="notification-preferences-group"
                  aria-label="All notifications"
                >
                  <div className="notification-preferences-card">
                    <PreferenceRow
                      label="Allow notifications"
                      description="Control in-app and push notifications for your account."
                      checked={preferences.enabled}
                      disabled={saving}
                      onChange={(value) => void toggle("enabled", value)}
                    />
                  </div>
                </section>
                {groups.map(({ title, Icon, items }) => (
                  <section
                    className="notification-preferences-group"
                    key={title}
                    aria-label={title}
                  >
                    <h3>
                      <Icon aria-hidden="true" />
                      {title}
                    </h3>
                    <div className="notification-preferences-card">
                      {items.map(({ key, label, description, readOnly }) => (
                        <PreferenceRow
                          key={key}
                          label={label}
                          description={description}
                          checked={(preferences[key] as boolean) ?? true}
                          disabled={saving || readOnly || !preferences.enabled}
                          onChange={(value) => void toggle(key, value)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
                <p className="notification-preferences-help">
                  Categories, sounds and banners apply to this device. The main
                  notification switch and safety preferences apply to your
                  account.
                </p>
              </>
            )}
          </div>
          <footer className="notification-preferences-footer">
            {saving && (
              <SerkleLoader size="xs" label="Saving preference" showText />
            )}
            <Dialog.Close className="notification-button notification-button--primary">
              Done
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
