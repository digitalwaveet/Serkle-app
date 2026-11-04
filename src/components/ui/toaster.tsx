import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

type ToastVariant = "default" | "success" | "info" | "destructive";

const SUCCESS_KEYWORDS = ["saved", "added", "sent", "created", "done", "copied", "logged in", "welcome", "joined", "deleted", "uploaded"];
const DESTRUCTIVE_KEYWORDS = ["error", "failed", "invalid", "denied"];
const INFO_KEYWORDS = ["info", "pending", "note"];

function detectVariant(title?: string): ToastVariant {
  if (!title) return "default";
  const lower = title.toLowerCase();
  if (DESTRUCTIVE_KEYWORDS.some(k => lower.includes(k))) return "destructive";
  if (SUCCESS_KEYWORDS.some(k => lower.includes(k))) return "success";
  if (INFO_KEYWORDS.some(k => lower.includes(k))) return "info";
  return "default";
}

/* ── Animated SVG Icons (draw-in animations via inline CSS) ── */

const iconStyle = `
@keyframes draw-check { from { stroke-dashoffset: 48 } to { stroke-dashoffset: 0 } }
@keyframes draw-x { from { stroke-dashoffset: 20 } to { stroke-dashoffset: 0 } }
@keyframes pop-in { 0% { transform: scale(0); opacity: 0 } 60% { transform: scale(1.2) } 100% { transform: scale(1); opacity: 1 } }
@keyframes ring-bell { 0% { transform: rotate(0) } 15% { transform: rotate(14deg) } 30% { transform: rotate(-14deg) } 45% { transform: rotate(8deg) } 60% { transform: rotate(-8deg) } 75% { transform: rotate(3deg) } 100% { transform: rotate(0) } }
`;

const SuccessIcon = () => (
  <svg className="size-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" opacity="0.3" />
    <polyline points="8 12 11 15 16 9" strokeDasharray="48" strokeDashoffset="0" style={{ animation: "draw-check 0.5s ease-out forwards" }} />
  </svg>
);

const DestructiveIcon = () => (
  <svg className="size-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" opacity="0.3" />
    <line x1="9" y1="9" x2="15" y2="15" strokeDasharray="20" strokeDashoffset="0" style={{ animation: "draw-x 0.4s ease-out forwards" }} />
    <line x1="15" y1="9" x2="9" y2="15" strokeDasharray="20" strokeDashoffset="0" style={{ animation: "draw-x 0.4s 0.15s ease-out forwards" }} />
  </svg>
);

const InfoIcon = () => (
  <svg className="size-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}>
    <circle cx="12" cy="12" r="10" opacity="0.3" />
    <line x1="12" y1="12" x2="12" y2="16" />
    <circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none" />
  </svg>
);

const DefaultIcon = () => (
  <svg className="size-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "ring-bell 0.6s ease-out forwards", transformOrigin: "top center" }}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ICONS: Record<ToastVariant, React.FC> = {
  success: SuccessIcon,
  destructive: DestructiveIcon,
  info: InfoIcon,
  default: DefaultIcon,
};

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      <style>{iconStyle}</style>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const detected = variant as ToastVariant || detectVariant(typeof title === "string" ? title : undefined);
        const Icon = ICONS[detected] || ICONS.default;
        return (
          <Toast key={id} variant={detected} {...props}>
            <Icon />
            {title && <ToastTitle>{title}</ToastTitle>}
            {/* description intentionally omitted — title-only pill */}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
