import { useId, type ElementType, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-group">
      <h3>{title}</h3>
      <div className="settings-card">{children}</div>
    </section>
  );
}
export function SettingsRow({
  icon: Icon,
  label,
  description,
  children,
  stack = false,
}: {
  icon: ElementType;
  label: string;
  description: ReactNode;
  children?: ReactNode;
  stack?: boolean;
}) {
  return (
    <div className={`settings-row${stack ? " settings-row--stack" : ""}`}>
      <span className="settings-row-icon">
        <Icon aria-hidden="true" />
      </span>
      <div className="settings-row-copy">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      {children && <div className="settings-row-control">{children}</div>}
    </div>
  );
}
export function SettingsToggle({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  disabled,
  busy,
}: {
  icon: ElementType;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const id = useId();
  return (
    <div className="settings-row">
      <span className="settings-row-icon">
        <Icon aria-hidden="true" />
      </span>
      <div className="settings-row-copy">
        <label htmlFor={id}>{label}</label>
        <p id={`${id}-help`}>{description}</p>
      </div>
      <div className="settings-row-control">
        {busy && <SerkleLoader size="xs" label={`Saving ${label}`} />}
        <label className="settings-toggle-target">
          <Switch
            id={id}
            checked={checked}
            onCheckedChange={onChange}
            disabled={disabled}
            aria-describedby={`${id}-help`}
          />
        </label>
      </div>
    </div>
  );
}
