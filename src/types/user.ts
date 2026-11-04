// User data types for the application
import { Session } from '@supabase/supabase-js';

export interface UserStats {
  followers: number;
  following: number;
  replies: number;
  posts: number;
  videos: number;
  saves: number;
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  initials: string;
  avatar: string;
  avatarColor?: string;
  coverImage?: string;
  bio?: string;
  subtitle?: string;
  location?: string;
  website?: string | string[];
  joinedDate: string;
  isVerified: boolean;
  isOnline: boolean;
  isPrivate: boolean;
  hideFollowers: boolean;
  hideOnlineStatus: boolean;
  allowMessagesFrom: 'everyone' | 'followers' | 'nobody';
  stats: UserStats;
  phone?: string;
  birthday?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    posts: boolean;
    comments: boolean;
    followers: boolean;
    messages: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'friends' | 'private';
    showOnlineStatus: boolean;
    allowMessages: boolean;
  };
}

export interface UserContextType {
  user: UserProfile | null;
  session: Session | null;
  preferences: UserPreferences;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  refreshUser: () => Promise<void>;
}