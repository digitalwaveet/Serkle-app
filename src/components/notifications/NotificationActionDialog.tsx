import React, { type RefObject } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { SerkleLoader } from "@/components/ui/SerkleLoader";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  destructive?: boolean;
  onConfirm: () => void;
  returnFocusRef: RefObject<HTMLElement>;
  fallbackFocusRef: RefObject<HTMLElement>;
}
export default function NotificationActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  error,
  destructive,
  onConfirm,
  returnFocusRef,
  fallbackFocusRef,
}: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="notification-preferences-overlay" />
        <AlertDialog.Content
          className="notification-ui notification-action-dialog"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            const target = returnFocusRef.current?.isConnected
              ? returnFocusRef.current
              : fallbackFocusRef.current;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <header>
            <AlertDialog.Title>{title}</AlertDialog.Title>
            <AlertDialog.Description>{description}</AlertDialog.Description>
          </header>
          {error && (
            <p
              className="notification-notice notification-notice--error"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="notification-action-dialog-buttons">
            <AlertDialog.Cancel
              className="notification-button"
              disabled={pending}
            >
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
              className={`notification-button ${destructive ? "notification-button--danger" : "notification-button--primary"}`}
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
            >
              {pending && (
                <SerkleLoader
                  size="xs"
                  label={
                    destructive ? "Clearing notifications" : "Resharing story"
                  }
                  className="text-current"
                />
              )}
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
