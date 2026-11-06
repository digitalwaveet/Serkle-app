const messages = {
  answer: { one: "answer", other: "answers" },
  question: { one: "question", other: "questions" },
  upvote: { one: "upvote", other: "upvotes" },
  update: { one: "story update", other: "story updates" },
  expertAnswer: { one: "expert reply", other: "expert replies" },
  follower: { one: "follower", other: "followers" },
};
export type AskCountUnit = keyof typeof messages;
/** Choose readable initials without changing an anonymous identity's color. */
export function anonymousTextColor(hex: string) {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((value) => parseInt(value, 16) / 255) || [0, 0, 0];
  const light = channels
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
      0,
    );
  return 1.05 / (light + 0.05) >= 4.5 ? "#ffffff" : "#111111";
}
const locale = (value?: string) =>
  value || (typeof navigator === "undefined" ? "en" : navigator.language);
export function formatAskNumber(
  count: number | null | undefined,
  language?: string,
) {
  return typeof count === "number" && Number.isFinite(count)
    ? new Intl.NumberFormat(locale(language)).format(count)
    : "—";
}
export function formatAskCount(
  count: number,
  unit: AskCountUnit,
  language?: string,
) {
  const form =
    new Intl.PluralRules("en").select(count) === "one" ? "one" : "other";
  return `${formatAskNumber(count, language)} ${messages[unit][form]}`;
}
export const ASK_CATEGORIES = [
  { value: "parenting", label: "Parenting" },
  { value: "health", label: "Health" },
  { value: "relationships", label: "Relationships" },
  { value: "career", label: "Career" },
  { value: "mental-health", label: "Mental health" },
  { value: "education", label: "Education" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "family", label: "Family" },
  { value: "other", label: "Other" },
] as const;
export function askCategory(value: string) {
  return (
    ASK_CATEGORIES.find((category) => category.value === value)?.label || value
  );
}
export function isAskSummaryReady(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const summary = value as Record<string, unknown>;
  return (
    summary.status === "ready" &&
    ((typeof summary.summary_overview === "string" &&
      !!summary.summary_overview.trim()) ||
      ["most_suggest", "different_perspectives", "expert_input"].some(
        (key) =>
          Array.isArray(summary[key]) &&
          (summary[key] as unknown[]).some(
            (item) => typeof item === "string" && item.trim(),
          ),
      ))
  );
}
export function askTime(value?: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime()))
    return "Time unavailable";
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const scale =
    Math.abs(seconds) >= 86400 ? 86400 : Math.abs(seconds) >= 3600 ? 3600 : 60;
  return new Intl.RelativeTimeFormat(locale(), { numeric: "auto" }).format(
    Math.round(seconds / scale),
    scale === 86400 ? "day" : scale === 3600 ? "hour" : "minute",
  );
}
