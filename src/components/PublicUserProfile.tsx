import { signProtectedMedia } from '@/lib/protectedMedia';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { Calendar, Link as LinkIcon, MessageCircle, ExternalLink, Lock, X, Play, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useFollowMutations } from '@/hooks/useFollowMutations';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { BioRichTextRenderer } from '@/components/BioRichTextRenderer';
import { useVideoViewTracker } from '@/hooks/useVideoViewTracker';
import { formatCount } from '@/utils/formatters';
import ProfileBadge from '@/components/profile/ProfileBadge';
import FollowStats from '@/components/profile/FollowStats';
import ProfileOverflowMenu from '@/components/profile/ProfileOverflowMenu';
import CoverImage from '@/components/profile/CoverImage';
import LocationDisplay from '@/components/profile/LocationDisplay';

interface PublicUserProfileProps {
  userId: string;
  className?: string;
  showHeader?: boolean;
  onMessageClick?: () => void;
  onClose?: () => void;
}

const PublicUserProfile: React.FC<PublicUserProfileProps> = ({ 
  userId,
  className = '',
  showHeader = true,
  onMessageClick,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAllBio, setShowAllBio] = useState(false);
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [showAvatarFull, setShowAvatarFull] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const navigate = useNavigate();
  const { toggleFollow, checkFollowStatus, isFollowing: isFollowingMutation } = useFollowMutations();
  const { user: currentUser } = useUser();

  // Check initial follow status
  useEffect(() => {
    const checkInitialFollowStatus = async () => {
      if (currentUser && userId && currentUser.id !== userId) {
        const following = await checkFollowStatus(userId);
        setIsFollowing(following);
      }
    };
    checkInitialFollowStatus();
  }, [userId, currentUser, checkFollowStatus]);

  // Fetch user profile data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch profile with stats
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(`
            *,
            profile_stats(
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

        if (profileError) throw profileError;

        if (profileData) {
          setUser({
            id: profileData.id,
            name: profileData.name,
            username: profileData.username,
            initials: profileData.initials,
            avatar: profileData.avatar_url,
            avatarColor: profileData.avatar_color,
            coverImage: profileData.cover_image_url,
            bio: profileData.bio,
            subtitle: profileData.subtitle,
            location: profileData.location,
            website: profileData.website ? [profileData.website] : [],
            joinedDate: profileData.joined_date,
            isVerified: profileData.is_verified,
            isPrivate: profileData.is_private ?? false,
            hideFollowers: profileData.hide_followers ?? false,
            hideOnlineStatus: profileData.hide_online_status ?? false,
            allowMessagesFrom: profileData.allow_messages_from || 'everyone',
            stats: {
              followers: profileData.profile_stats?.followers_count || 0,
              following: profileData.profile_stats?.following_count || 0,
              posts: profileData.profile_stats?.posts_count || 0,
              videos: profileData.profile_stats?.videos_count || 0
            }
          });
        }

        // Fetch user's posts
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id(name, username, initials, avatar_url, avatar_color, is_verified),
            post_stats(likes_count, comments_count, shares_count, saves_count)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (postsError) throw postsError;
        setPosts(await signProtectedMedia(postsData || []));

        // Fetch user's videos
        const { data: videosData, error: videosError } = await supabase
          .from('videos')
          .select(`
            *,
            video_stats(likes_count, comments_count, shares_count, saves_count, views_count)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (videosError) throw videosError;
        setVideos(videosData || []);

      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!userId) return;

    // Subscribe to profile changes
    const profileChannel = supabase
      .channel('profile-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`
      }, () => {
        // Refetch profile data on change
        fetchUserData();
      })
      .subscribe();

    // Subscribe to posts changes
    const postsChannel = supabase
      .channel('user-posts-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts',
        filter: `user_id=eq.${userId}`
      }, () => {
        // Refetch posts on change
        fetchUserData();
      })
      .subscribe();

    // Subscribe to videos changes
    const videosChannel = supabase
      .channel('user-videos-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'videos',
        filter: `user_id=eq.${userId}`
      }, () => {
        // Refetch videos on change
        fetchUserData();
      })
      .subscribe();

    const fetchUserData = async () => {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select(`
            *,
            profile_stats(
              followers_count,
              following_count,
              posts_count,
              videos_count
            )
          `)
          .eq('id', userId)
          .single();

        if (profileData) {
          setUser({
            id: profileData.id,
            name: profileData.name,
            username: profileData.username,
            initials: profileData.initials,
            avatar: profileData.avatar_url,
            avatarColor: profileData.avatar_color,
            coverImage: profileData.cover_image_url,
            bio: profileData.bio,
            subtitle: profileData.subtitle,
            location: profileData.location,
            website: profileData.website ? [profileData.website] : [],
            joinedDate: profileData.joined_date,
            isVerified: profileData.is_verified,
            isPrivate: profileData.is_private ?? false,
            hideFollowers: profileData.hide_followers ?? false,
            hideOnlineStatus: profileData.hide_online_status ?? false,
            allowMessagesFrom: profileData.allow_messages_from || 'everyone',
            stats: {
              followers: profileData.profile_stats?.followers_count || 0,
              following: profileData.profile_stats?.following_count || 0,
              posts: profileData.profile_stats?.posts_count || 0,
              videos: profileData.profile_stats?.videos_count || 0
            }
          });
        }

        const { data: postsData } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id(name, username, initials, avatar_url, avatar_color, is_verified),
            post_stats(likes_count, comments_count, shares_count, saves_count)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        setPosts(await signProtectedMedia(postsData || []));

        const { data: videosData } = await supabase
          .from('videos')
          .select(`
            *,
            video_stats(likes_count, comments_count, shares_count, saves_count, views_count)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        setVideos(videosData || []);
      } catch (error) {
        console.error('Error refetching user data:', error);
      }
    };

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(videosChannel);
    };
  }, [userId]);

  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const PostCard = ({ post }: { post: any }) => {
    // Detect image from regular posts or circle premium posts
    const isPdf = post.post_type?.toLowerCase() === 'pdf';
    
    const displayImage = isPdf 
      ? (Array.isArray(post.media_urls) && post.media_urls.length > 0 ? post.media_urls[0] : post.cover_image_url || post.media_url)
      : (post.media_url || post.cover_image_url || (Array.isArray(post.media_urls) && post.media_urls.length > 0 ? post.media_urls[0] : null));

    const isVideo = (url: string) => /\.(mp4|webm|mov|ogg|m3u8)(\?|$)/i.test(url);
    const videoUrl = [post.media_url, ...(post.media_urls || [])].find(url => url && isVideo(url));

    return (
      <div 
        className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300"
        onClick={() => {
          onClose?.();
          navigate(`/post/${post.id}`);
        }}
      >
        <div className="aspect-[4/5] relative overflow-hidden bg-black/5">
          {isPdf && (
            <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md rounded-md px-1.5 py-0.5 border border-white/10 shadow-sm transition-transform group-hover:scale-110 z-10 flex items-center gap-1">
              <FileText className="w-3 h-3 text-primary" />
              <span className="text-[9px] font-black text-white uppercase tracking-tighter">PDF</span>
            </div>
          )}
          {videoUrl ? (
            <video 
              src={videoUrl} 
              poster={displayImage && !isVideo(displayImage) ? displayImage : undefined}
              className="w-full h-full object-cover"
              preload="metadata"
              muted
              playsInline
            />
          ) : displayImage ? (
            <img 
              src={displayImage} 
              alt="" 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/30 p-4">
              <p className="text-[10px] text-muted-foreground text-center line-clamp-3 italic opacity-60">{post.content}</p>
            </div>
          )}
          
          {videoUrl && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/30 backdrop-blur-md rounded-full p-2 border border-white/20 shadow-2xl">
                <Play className="size-5 text-white fill-white opacity-90" />
              </div>
            </div>
          )}
          
          {videoUrl && (
            <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md rounded-full p-1.5 border border-white/10 shadow-sm transition-transform group-hover:scale-110">
              <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-white ml-0.5" />
            </div>
          )}

        
        {/* Glassmorphic Overlay for Caption */}
        <div className="absolute inset-x-0 bottom-0 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-background/20 backdrop-blur-md border border-white/10 rounded-xl p-2 shadow-lg">
            <p className="text-[10px] text-white line-clamp-1 font-medium">{post.content || "View post"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

  const VideoCard = ({ video }: { video: any }) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    
    // Attaches the tracking logic to track muted autoplay views on the profile grid
    useVideoViewTracker(videoRef.current, video.id);

    return (
      <div 
        className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300"
        onClick={() => {
          onClose?.();
          navigate(`/video/${video.id}`);
        }}
      >
        <div className="aspect-[9/16] relative overflow-hidden bg-black/5">
          {video.thumbnail_url ? (
            <img 
              src={video.thumbnail_url} 
              alt={video.title} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
            />
          ) : video.video_url ? (
            <video 
              ref={videoRef}
              src={video.video_url} 
              className="w-full h-full object-cover" 
              preload="metadata"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}

          {/* Glassmorphic Play Badge */}
          <div className="absolute top-2 right-2 bg-black/20 backdrop-blur-md border border-white/10 rounded-full px-2 py-1 flex items-center gap-1 shadow-sm">
            <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-white ml-0.5" />
            <span className="text-[10px] font-bold text-white">
              {formatCount(video.video_stats?.[0]?.views_count || video.video_stats?.views_count || 0)}
            </span>
          </div>

          {/* Glassmorphic Info Banner */}
          <div className="absolute inset-x-2 bottom-2 p-2 bg-black/20 backdrop-blur-md border border-white/20 rounded-xl shadow-lg transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <p className="text-[11px] font-semibold text-white line-clamp-1">{video.title || "Untitled Video"}</p>
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = ({ icon: Icon, message }: { icon: any; message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-12 w-12 mb-4 opacity-50" />
      <p className="text-center">{message}</p>
    </div>
  );

  const LinksModal = () => {
    const websites = Array.isArray(user.website) ? user.website : user.website ? [user.website] : [];
    
    return (
      <Dialog open={showLinksModal} onOpenChange={setShowLinksModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Links</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {websites.map((link, index) => (
              <a
                key={index}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="flex-1 truncate">{link}</span>
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading profile" showText /></div>
    );
  }

  const bioLimit = 150;
  const shouldTruncateBio = user.bio && user.bio.length > bioLimit;
  const displayBio = shouldTruncateBio && !showAllBio 
    ? user.bio.slice(0, bioLimit) + '...' 
    : user.bio;

  const websites = Array.isArray(user.website) ? user.website : user.website ? [user.website] : [];

  return (
    <div className={`w-full pb-32 ${className}`}>
      {/* Cover Image with brand-gradient empty state */}
      <CoverImage coverUrl={user.coverImage} avatarUrl={user.avatar} className="h-36" />

      {/* Profile Info */}
      <div className="px-4 pb-3">
        {/* Avatar — overlaps cover */}
        <div className="relative -mt-12 mb-3">
          <button onClick={() => user.avatar && setShowAvatarFull(true)} className="block">
            <Avatar className="h-24 w-24 border-4 border-background cursor-pointer hover:opacity-90 transition-opacity">
              <AvatarImage src={user.avatar} />
              <AvatarFallback
                className="text-2xl font-bold text-white"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>

        {/* Full-screen avatar lightbox */}
        {showAvatarFull && user.avatar && (
          <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fade-in"
            onClick={() => setShowAvatarFull(false)}
          >
            <button
              className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
              onClick={() => setShowAvatarFull(false)}
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={user.avatar}
              alt={user.name}
              className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain"
            />
          </div>
        )}

        {/* Name + Badge + username */}
        <div className="mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-xl font-bold truncate">{user.name}</h1>
            {user.isVerified && <ProfileBadge type="verified" />}
          </div>
          <p className="text-sm text-muted-foreground truncate">{user.username}</p>
        </div>

        {/* Social proof — compact, tappable, high on the profile */}
        {!user.hideFollowers && (
          <FollowStats
            userId={userId}
            followers={user.stats.followers}
            following={user.stats.following}
            onProfileClick={onClose}
            className="mb-3"
          />
        )}

        {/* Primary actions + overflow */}
        <div className="flex gap-2 mb-3">
          {currentUser?.id !== userId && (
            <Button
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              className="flex-1 h-9"
              onClick={async () => {
                if (!currentUser) {
                  toast.error('Please login to follow users');
                  return;
                }
                const newFollowState = await toggleFollow(userId);
                setIsFollowing(newFollowState);
              }}
              disabled={isFollowingMutation}
            >
              {isFollowing ? 'Unfollow' : 'Follow'}
            </Button>
          )}
          {(!user.allowMessagesFrom || user.allowMessagesFrom === 'everyone' ||
            (user.allowMessagesFrom === 'followers' && isFollowing)) && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onMessageClick) {
                  onMessageClick();
                } else {
                  navigate(`/messages?userId=${userId}`);
                }
              }}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Message
            </Button>
          )}
          {currentUser?.id !== userId && (
            <ProfileOverflowMenu userId={userId} username={user.username} />
          )}
        </div>

        {/* Bio */}
        {user.bio && (
          <div className="mb-2">
            <p className="text-sm whitespace-pre-wrap break-words" dir="auto">
              <BioRichTextRenderer text={displayBio} />
              {shouldTruncateBio && (
                <button
                  onClick={() => setShowAllBio(!showAllBio)}
                  className="text-primary ml-1 hover:underline"
                >
                  {showAllBio ? 'Show less' : 'Show more'}
                </button>
              )}
            </p>
          </div>
        )}

        {/* Metadata: location, links, joined — single compact block */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          {user.location && <LocationDisplay location={user.location} />}

          {websites.length > 0 && (
            <div className="flex items-center gap-1.5 text-primary min-w-0">
              <LinkIcon className="h-3.5 w-3.5 flex-shrink-0" />
              {websites.length === 1 ? (
                <a
                  href={websites[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline truncate"
                >
                  {websites[0].replace(/^https?:\/\//, '')}
                </a>
              ) : (
                <button
                  onClick={() => setShowLinksModal(true)}
                  className="hover:underline"
                >
                  {websites.length} links
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Joined {new Date(user.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-11">
          <TabsTrigger
            value="posts"
            className="rounded-none border-b-[3px] border-transparent text-muted-foreground font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold transition-all"
          >
            Posts
          </TabsTrigger>
          <TabsTrigger
            value="videos"
            className="rounded-none border-b-[3px] border-transparent text-muted-foreground font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold transition-all"
          >
            Videos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-0">
          {user.isPrivate && !isFollowing && currentUser?.id !== userId ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Lock className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-semibold text-foreground mb-1">This account is private</p>
              <p className="text-center text-sm">Follow this account to see their posts.</p>
            </div>
          ) : posts.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5 px-4 sm:px-6">
              {posts.map((post) => <PostCard key={post.id} post={post} />)}
            </div>
          ) : (
            <EmptyState 
              icon={MessageCircle}
              message="No posts yet"
            />
          )}
        </TabsContent>

        <TabsContent value="videos" className="mt-0">
          {user.isPrivate && !isFollowing && currentUser?.id !== userId ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Lock className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-semibold text-foreground mb-1">This account is private</p>
              <p className="text-center text-sm">Follow this account to see their videos.</p>
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 px-4 sm:px-6">
              {videos.map((video) => <VideoCard key={video.id} video={video} />)}
            </div>
          ) : (
            <EmptyState 
              icon={MessageCircle}
              message="No videos yet"
            />
          )}
        </TabsContent>
      </Tabs>

      <LinksModal />
    </div>
  );
};

export default PublicUserProfile;
