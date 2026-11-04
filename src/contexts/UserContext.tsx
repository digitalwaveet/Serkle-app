import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, UserPreferences, UserContextType } from '@/types/user';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { chatDb } from '@/lib/db';
import { registerSyncListeners } from '@/lib/sync';

const CACHED_PROFILE_KEY = 'cached_user_profile';
const CACHED_SESSION_KEY = 'cached_has_session';

const cacheProfile = (profile: UserProfile | null) => {
  try {
    if (profile) {
      localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem(CACHED_SESSION_KEY, 'true');
    } else {
      localStorage.removeItem(CACHED_PROFILE_KEY);
      localStorage.removeItem(CACHED_SESSION_KEY);
    }
  } catch {}
};

const getCachedProfile = (): UserProfile | null => {
  try {
    const cached = localStorage.getItem(CACHED_PROFILE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const hadSession = (): boolean => {
  try {
    return localStorage.getItem(CACHED_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
};

const UserContext = createContext<UserContextType | undefined>(undefined);

// Mock user data - in a real app, this would come from your backend/Supabase
const mockUser: UserProfile = {
  id: "user_1",
  name: "Bezawit",
  username: "beza",
  email: "bezawit@example.com",
  initials: "BZ",
  avatar: "https://images.unsplash.com/photo-1494790108755-2616c90db5f3?auto=format&fit=crop&w=300&h=300&q=80",
  coverImage: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=60",
  bio: "Passionate about preserving nature and ensuring a sustainable future for the next generation.",
  subtitle: "Preserve Nature, Ensure Future",
  location: "San Francisco, CA",
  website: [
    "https://bezawit.dev",
    "https://github.com/bezawit",
    "https://linkedin.com/in/bezawit",
    "https://twitter.com/bezawit"
  ],
  joinedDate: "2023-01-15",
  isVerified: true,
  isOnline: true,
  isPrivate: false,
  hideFollowers: false,
  hideOnlineStatus: false,
  allowMessagesFrom: 'everyone',
  stats: {
    followers: 501,
    following: 163,
    replies: 353,
    posts: 24,
    videos: 8,
    saves: 45
  }
};

const defaultPreferences: UserPreferences = {
  theme: 'auto',
  notifications: {
    posts: true,
    comments: true,
    followers: true,
    messages: true,
  },
  privacy: {
    profileVisibility: 'public',
    showOnlineStatus: true,
    allowMessages: true,
  }
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  // Initialize from cache for instant offline hydration
  const [user, setUser] = useState<UserProfile | null>(() => getCachedProfile());
  const [session, setSession] = useState<Session | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(() => !getCachedProfile());
  const [error, setError] = useState<string | null>(null);

  // Wrap setUser to also cache
  const setUserAndCache = (profile: UserProfile | null) => {
    setUser(profile);
    cacheProfile(profile);
  };

  useEffect(() => {
    const isOnline = navigator.onLine;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUserAndCache(null);
        setIsLoading(false);
        chatDb.delete(); // Delete local encrypted database on logout
        window.location.href = '/login';
        return;
      }
      
      if (event === 'TOKEN_REFRESHED' && !session) {
        if (navigator.onLine) {
          await supabase.auth.signOut();
          window.location.href = '/login';
        }
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        if (window.location.pathname !== '/reset-password') {
          window.location.href = '/reset-password';
        }
        return;
      }

      setSession(session);
      if (session?.access_token) {
        chatDb.initEncryption(session.access_token);
        registerSyncListeners();
      }
      
      if (session?.user) {
        setTimeout(() => {
          fetchUserProfile(session.user.id);
        }, 0);
      } else if (!getCachedProfile()) {
        setUser(null);
        setIsLoading(false);
      } else {
        // If we have a cached profile but no session and we are online, clear it
        if (navigator.onLine) {
          setUserAndCache(null);
        }
        setIsLoading(false);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error);
        // If offline and we have cached data, don't redirect
        if (!navigator.onLine && hadSession()) {
          setIsLoading(false);
          return;
        }
        await supabase.auth.signOut();
        setIsLoading(false);
        window.location.href = '/login';
        return;
      }

      setSession(session);
      if (session?.access_token) {
        chatDb.initEncryption(session.access_token);
        registerSyncListeners();
      }
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else if (!navigator.onLine && hadSession()) {
        // Offline but had a session before — use cached profile
        setIsLoading(false);
      } else {
        // No session found and not offline with cache — clear user to stay in sync
        if (navigator.onLine) {
          setUserAndCache(null);
        }
        setIsLoading(false);
      }
    }).catch(() => {
      // Network error — use cached profile if available
      if (hadSession() && getCachedProfile()) {
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string, isRetry = false) => {
    // If offline and we already have a cached profile, skip the network call entirely
    if (!navigator.onLine && getCachedProfile()) {
      console.log('Offline: skipping profile fetch, using cache');
      setIsLoading(false);
      return;
    }
    try {
      // Only show loading if we don't already have a user (prevents spinner flash on refetch)
      if (!getCachedProfile()) {
        setIsLoading(true);
      }
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          *,
          profile_stats (
            followers_count,
            following_count,
            posts_count,
            videos_count,
            replies_count,
            saves_count
          )
        `)
        .eq('id', userId)
        .single();

      if (error) {
        // If profile fetch fails, it might be an auth issue
        if (error.code === 'PGRST301' || error.message.includes('JWT')) {
          await supabase.auth.signOut();
          window.location.href = '/login';
          return;
        }
        // If no profile exists yet (new user), create it in the database
        if (error.code === 'PGRST116') {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';
            const baseUsername = authUser.user_metadata?.username || authUser.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
            const username = `${baseUsername}_${authUser.id.substring(0, 4)}`;
            const initials = name.substring(0, 2).toUpperCase();
            const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null;

            // Insert the profile row so foreign keys work
            const { error: insertError } = await supabase.from('profiles').insert({
              id: authUser.id,
              name,
              username,
              email: authUser.email || '',
              initials,
              avatar_url: avatarUrl,
              avatar_color: '#4B164C',
            });

            if (insertError) {
              console.error('Failed to create profile:', insertError);
            }

            const fallbackProfile: UserProfile = {
              id: authUser.id,
              name,
              username,
              email: authUser.email || '',
              initials,
              avatar: avatarUrl || '',
              avatarColor: '#4B164C',
              coverImage: '',
              bio: '',
              subtitle: '',
              location: '',
              website: [],
              joinedDate: authUser.created_at,
              isVerified: false,
              isOnline: true,
              isPrivate: false,
              hideFollowers: false,
              hideOnlineStatus: false,
              allowMessagesFrom: 'everyone',
              stats: { followers: 0, following: 0, replies: 0, posts: 0, videos: 0, saves: 0 }
            };
            setUserAndCache(fallbackProfile);
            return;
          }
        }
        // If it's a network error and we haven't retried yet, try once more after a short delay
        if (error.message?.includes('Failed to fetch') && !isRetry) {
          console.log(`Retrying profile fetch for ${userId}...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          return fetchUserProfile(userId, true);
        }
        throw error;
      }

      if (profile) {
        let avatarUrl = profile.avatar_url || '';
        if (!avatarUrl) {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          const oauthAvatar = authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture;
          if (oauthAvatar) {
            avatarUrl = oauthAvatar;
            supabase.from('profiles').update({ avatar_url: oauthAvatar }).eq('id', userId).then();
          }
        }

        const userProfile: UserProfile = {
          id: profile.id,
          name: profile.name,
          username: profile.username,
          email: profile.email,
          initials: profile.initials,
          avatar: avatarUrl,
          avatarColor: profile.avatar_color || '#4B164C',
          coverImage: profile.cover_image_url || '',
          bio: profile.bio || '',
          subtitle: profile.subtitle || '',
          location: profile.location || '',
          website: profile.website ? [profile.website] : [],
          joinedDate: profile.joined_date,
          isVerified: profile.is_verified,
          isOnline: profile.is_online,
          isPrivate: profile.is_private ?? false,
          hideFollowers: profile.hide_followers ?? false,
          hideOnlineStatus: profile.hide_online_status ?? false,
          allowMessagesFrom: (profile.allow_messages_from as 'everyone' | 'followers' | 'nobody') || 'everyone',
          stats: {
            followers: profile.profile_stats?.[0]?.followers_count || 0,
            following: profile.profile_stats?.[0]?.following_count || 0,
            replies: profile.profile_stats?.[0]?.replies_count || 0,
            posts: profile.profile_stats?.[0]?.posts_count || 0,
            videos: profile.profile_stats?.[0]?.videos_count || 0,
            saves: profile.profile_stats?.[0]?.saves_count || 0,
          },
          phone: profile.phone || '',
          birthday: profile.birthday || '',
        };
        setUserAndCache(userProfile);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      // If offline and we have a cached profile, use it silently
      if (!navigator.onLine && getCachedProfile()) {
        console.log('Offline: using cached profile');
      } else {
        setError('Failed to load user data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.username !== undefined && { username: updates.username }),
          ...(updates.email !== undefined && { email: updates.email }),
          ...(updates.bio !== undefined && { bio: updates.bio }),
          ...(updates.subtitle !== undefined && { subtitle: updates.subtitle }),
          ...(updates.location !== undefined && { location: updates.location }),
          ...(updates.website !== undefined && { website: Array.isArray(updates.website) ? updates.website[0] : updates.website }),
          ...(updates.avatar !== undefined && { avatar_url: updates.avatar }),
          ...(updates.coverImage !== undefined && { cover_image_url: updates.coverImage }),
        })
        .eq('id', user.id);

      if (error) throw error;
      
      const updatedUser = { ...user, ...updates };
      setUserAndCache(updatedUser);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (err) {
      setError('Failed to update profile');
      toast({
        title: "Update failed",
        description: "Could not update your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setPreferences(prev => ({ ...prev, ...updates }));
      
      toast({
        title: "Preferences updated",
        description: "Your preferences have been saved.",
      });
    } catch (err) {
      setError('Failed to update preferences');
      toast({
        title: "Update failed",
        description: "Could not save your preferences. Please try again.",
        variant: "destructive",
      });
    }
  };

  const refreshUser = async () => {
    if (!session?.user) return;
    
    try {
      setIsLoading(true);
      await fetchUserProfile(session.user.id);
      setError(null);
    } catch (err) {
      setError('Failed to refresh user data');
    } finally {
      setIsLoading(false);
    }
  };

  const value: UserContextType = {
    user,
    session,
    preferences,
    isLoading,
    error,
    updateProfile,
    updatePreferences,
    refreshUser,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};