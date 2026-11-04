export type CircleCountUnit =
  | 'attendee'
  | 'circle'
  | 'comment'
  | 'event'
  | 'file'
  | 'invite'
  | 'member'
  | 'playlist'
  | 'post'
  | 'resource'
  | 'request'
  | 'subscriber'
  | 'video';

type PluralForms = Partial<Record<string, string>> & { other: string };
type CircleCountMessages = Record<CircleCountUnit, PluralForms>;

// Keep count labels in locale catalogs so adding a locale doesn't add
// component-specific plural rules or formatting branches.
const countMessages: Record<string, CircleCountMessages> = {
  en: {
    attendee: { one: 'attendee', other: 'attendees' },
    circle: { one: 'circle', other: 'circles' },
    comment: { one: 'comment', other: 'comments' },
    event: { one: 'event', other: 'events' },
    file: { one: 'file', other: 'files' },
    invite: { one: 'invite', other: 'invites' },
    member: { one: 'member', other: 'members' },
    playlist: { one: 'playlist', other: 'playlists' },
    post: { one: 'post', other: 'posts' },
    resource: { one: 'resource', other: 'resources' },
    request: { one: 'request', other: 'requests' },
    subscriber: { one: 'subscriber', other: 'subscribers' },
    video: { one: 'video', other: 'videos' },
  },
};

const getLocale = (locale?: string) =>
  locale || (typeof navigator !== 'undefined' ? navigator.language : 'en');

const getMessages = (locale: string) => {
  const language = locale.toLowerCase().split('-')[0];
  return countMessages[language] || countMessages.en;
};

/** Returns the locale's singular or plural noun for a Circle count. */
export const getCircleCountLabel = (count: number, unit: CircleCountUnit, locale?: string) => {
  const resolvedLocale = getLocale(locale);
  const messages = getMessages(resolvedLocale);
  const pluralLocale = countMessages[resolvedLocale.toLowerCase().split('-')[0]]
    ? resolvedLocale
    : 'en';
  const category = new Intl.PluralRules(pluralLocale).select(count);
  return messages[unit][category] || messages[unit].other;
};

/** Formats a count using the current or supplied locale. */
export const formatCircleNumber = (count: number, locale?: string) =>
  new Intl.NumberFormat(getLocale(locale)).format(count);

/** Formats a count and its localized noun as one label, e.g. "2 videos". */
export const formatCircleCount = (count: number, unit: CircleCountUnit, locale?: string) => {
  const resolvedLocale = getLocale(locale);
  const formattedCount = formatCircleNumber(count, resolvedLocale);
  return `${formattedCount} ${getCircleCountLabel(count, unit, resolvedLocale)}`;
};
