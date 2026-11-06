import React, { createContext, useContext, useRef } from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import "./ask.css";
const Depth = createContext(0);
export function Dialog(props: React.ComponentProps<typeof Primitive.Root>) {
  const depth = useContext(Depth);
  return (
    <Depth.Provider value={depth + 1}>
      <Primitive.Root {...props} />
    </Depth.Provider>
  );
}
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content> & { busy?: boolean }
>(
  (
    {
      className,
      children,
      style,
      onOpenAutoFocus,
      onCloseAutoFocus,
      busy,
      ...props
    },
    ref,
  ) => {
    const depth = useContext(Depth);
    const opener = useRef<HTMLElement | null>(null);
    const level = 110 + Math.max(1, depth) * 40;
    return (
      <Primitive.Portal>
        <Primitive.Overlay
          className="ask-overlay"
          style={{ zIndex: level - 1 }}
        />
        <Primitive.Content
          ref={ref}
          {...props}
          aria-busy={busy}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
            else props.onEscapeKeyDown?.(event);
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
            else props.onInteractOutside?.(event);
          }}
          className={cn("ask-ui ask-dialog", className)}
          style={{ ...style, zIndex: level }}
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
        >
          {children}
          <Primitive.Close
            className="ask-dialog-close"
            aria-label="Close dialog"
            disabled={busy}
          >
            <X aria-hidden="true" />
          </Primitive.Close>
        </Primitive.Content>
      </Primitive.Portal>
    );
  },
);
DialogContent.displayName = "AskDialogContent";
export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ask-dialog-header", className)} {...props} />;
}
export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ask-dialog-footer", className)} {...props} />;
}
