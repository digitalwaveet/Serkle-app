import {
  GraduationCap,
  Users,
  Briefcase,
  Building2,
  Newspaper,
  HeartHandshake,
  Star,
  MapPin,
  MessageSquare,
  Video,
  CalendarDays,
  FolderOpen,
  Mail,
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for circle types and toggleable circle features.
 * The creation wizard, circle navigation, discovery cards and edit modal all
 * read from here so a circle's layout always matches its type.
 */

export type CircleFeature = 'posts' | 'videos' | 'services' | 'events' | 'resources' | 'messages';

export interface CircleFeatureConfig {
  id: CircleFeature;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Locked features are always enabled and cannot be toggled off. */
  locked?: boolean;
}

export const CIRCLE_FEATURES: CircleFeatureConfig[] = [
  { id: 'posts', label: 'Posts', icon: MessageSquare, description: 'Discussions and updates', locked: true },
  { id: 'videos', label: 'Videos', icon: Video, description: 'Video lessons and playlists' },
  { id: 'resources', label: 'Resources', icon: FolderOpen, description: 'Files, guides and downloads' },
  { id: 'events', label: 'Events', icon: CalendarDays, description: 'Live classes and meetups' },
  { id: 'services', label: 'Services', icon: Briefcase, description: 'Bookable sessions and services' },
  { id: 'messages', label: 'Messages', icon: Mail, description: 'Member chat room' },
];

/** Every feature, in default order — used for existing circles with no explicit selection. */
export const DEFAULT_FEATURES: CircleFeature[] = CIRCLE_FEATURES.map((f) => f.id);

export type CircleTypeId =
  | 'learning'
  | 'community'
  | 'consulting'
  | 'business'
  | 'news'
  | 'support_group'
  | 'creator_club'
  | 'local_community';

export interface CircleTypeConfig {
  id: CircleTypeId;
  label: string;
  tagline: string;
  icon: LucideIcon;
  /** Features pre-enabled when a creator picks this type. */
  defaultFeatures: CircleFeature[];
}

export const CIRCLE_TYPES: CircleTypeConfig[] = [
  {
    id: 'learning',
    label: 'Learning',
    tagline: 'Teach with videos, resources and live classes',
    icon: GraduationCap,
    defaultFeatures: ['posts', 'videos', 'resources', 'events'],
  },
  {
    id: 'community',
    label: 'Social',
    tagline: 'Bring people together around a shared interest',
    icon: Users,
    defaultFeatures: ['posts', 'events', 'messages'],
  },
  {
    id: 'consulting',
    label: 'Consulting',
    tagline: 'Offer bookable sessions and expert advice',
    icon: Briefcase,
    defaultFeatures: ['posts', 'services', 'events', 'resources'],
  },
  {
    id: 'business',
    label: 'Business',
    tagline: 'Grow an audience around your brand',
    icon: Building2,
    defaultFeatures: ['posts', 'services', 'videos', 'events'],
  },
  {
    id: 'news',
    label: 'News',
    tagline: 'Publish updates your members can follow',
    icon: Newspaper,
    defaultFeatures: ['posts', 'videos'],
  },
  {
    id: 'support_group',
    label: 'Support Group',
    tagline: 'A safe space for members to support each other',
    icon: HeartHandshake,
    defaultFeatures: ['posts', 'messages', 'events', 'resources'],
  },
  {
    id: 'creator_club',
    label: 'Creator Club',
    tagline: 'Exclusive content for your fans and supporters',
    icon: Star,
    defaultFeatures: ['posts', 'videos', 'events', 'messages'],
  },
  {
    id: 'local_community',
    label: 'Local',
    tagline: 'Meet and organize with people near you',
    icon: MapPin,
    defaultFeatures: ['posts', 'events', 'messages'],
  },
];

export const CIRCLE_CATEGORIES = [
  'General',
  'Sports',
  'Education',
  'Technology',
  'Art & Design',
  'Music',
  'Business',
  'Health & Wellness',
  'Travel',
  'Food & Cooking',
  'Gaming',
  'Other',
];

export const getCircleType = (id?: string | null): CircleTypeConfig =>
  CIRCLE_TYPES.find((t) => t.id === id) ?? CIRCLE_TYPES.find((t) => t.id === 'community')!;

export const getFeatureConfig = (id: string): CircleFeatureConfig | undefined =>
  CIRCLE_FEATURES.find((f) => f.id === id);

/** Circles created before the category rename still store 'Community'. */
export const displayCategory = (category?: string | null): string =>
  category === 'Community' ? 'General' : category ?? '';

/** Normalize a stored feature list: known ids only, locked features always included. */
export const normalizeFeatures = (features?: string[] | null): CircleFeature[] => {
  const valid = (features ?? DEFAULT_FEATURES).filter((f): f is CircleFeature =>
    CIRCLE_FEATURES.some((c) => c.id === f)
  );
  const withLocked = CIRCLE_FEATURES.filter((f) => f.locked).map((f) => f.id);
  return [...new Set([...withLocked, ...valid])];
};

/**
 * Public circle navigation: Feed | Learn | Events | About, with Services only
 * when the circle actually offers at least one active service (owners/admins
 * always see it so they can create the first one). Learn groups the videos
 * and resources features. Members/messages live in the Manage Circle area.
 */
export type CircleNavTab = 'feed' | 'learn' | 'events' | 'services' | 'about';

export const CIRCLE_NAV_LABELS: Record<CircleNavTab, string> = {
  feed: 'Feed',
  learn: 'Learn',
  events: 'Events',
  services: 'Services',
  about: 'About',
};

export const getCircleNav = (
  circle: {
    enabled_features?: string[] | null;
    services_count?: number;
  },
  canManage = false
): CircleNavTab[] => {
  const enabled = normalizeFeatures(circle.enabled_features);
  const tabs: CircleNavTab[] = ['feed'];
  if (enabled.includes('videos') || enabled.includes('resources')) tabs.push('learn');
  if (enabled.includes('events')) tabs.push('events');
  if (enabled.includes('services') && ((circle.services_count ?? 0) > 0 || canManage)) {
    tabs.push('services');
  }
  tabs.push('about');
  return tabs;
};

/** Old shared links used feature ids as the ?tab= value; map them to the new nav. */
export const LEGACY_TAB_MAP: Record<string, string> = {
  posts: 'feed',
  videos: 'learn',
  resources: 'learn',
};
