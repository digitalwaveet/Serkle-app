import React, { createContext, useContext, useRef } from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import "./messages.css";
const Depth = createContext(0);
export function Dialog(props: React.ComponentProps<typeof Primitive.Root>) {
  const depth = useContext(Depth);
  return (
    <Depth.Provider value={depth + 1}>
      <Primitive.Root {...props} />
    </Depth.Provider>
  );
}
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content> & {
    busy?: boolean;
    hideClose?: boolean;
  }
>(
  (
    {
      children,
      className = "",
      busy,
      hideClose,
      onOpenAutoFocus,
      onCloseAutoFocus,
      ...props
    },
    ref,
  ) => {
    const opener = useRef<HTMLElement | null>(null),
      depth = useContext(Depth);
    return (
      <Primitive.Portal>
        <Primitive.Overlay
          className="msg-overlay"
          style={{ zIndex: 160 + depth * 30 }}
        />
        <Primitive.Content
          {...props}
          ref={ref}
          className={`msg-ui msg-dialog ${className}`}
          style={{ ...props.style, zIndex: 161 + depth * 30 }}
          aria-busy={busy}
          onOpenAutoFocus={(event) => {
            opener.current = document.activeElement as HTMLElement;
            onOpenAutoFocus?.(event);
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (!event.defaultPrevented && opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
            else props.onEscapeKeyDown?.(event);
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
            else props.onInteractOutside?.(event);
          }}
        >
          {children}
          {!hideClose && (
            <Primitive.Close
              className="msg-icon msg-dialog-close"
              aria-label="Close dialog"
              disabled={busy}
            >
              <X aria-hidden="true" />
            </Primitive.Close>
          )}
        </Primitive.Content>
      </Primitive.Portal>
    );
  },
);
DialogContent.displayName = "MessagingDialogContent";
export function DialogHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`msg-dialog-heading ${props.className || ""}`} />
  );
}
export function DialogFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`msg-dialog-footer ${props.className || ""}`} />
  );
}
