import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, TrendingUp, User as UserIcon, FileText } from 'lucide-react';
import { VideoLoader } from '@/components/ui/VideoLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchUser {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
  initials: string;
  bio: string | null;
}

interface SearchPost {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface Trend {
  tag: string;
  count: number;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [isSearching, setIsSearching] = useState(false);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const navigate = useNavigate();

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || !isOpen) {
      setUsers([]);
      setPosts([]);
      setTrends([]);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    try {
      if (activeTab === 'users') {
        await searchUsers(query);
      } else if (activeTab === 'posts') {
        await searchPosts(query);
      } else if (activeTab === 'trends') {
        await searchTrends(query);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const searchUsers = async (query: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, name, avatar_url, initials, bio')
      .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(20);

    if (!error && data) {
      setUsers(data);
    }
  };

  const searchPosts = async (query: string) => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles:user_id (name, username, avatar_url)
      `)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setPosts(data as any);
    }
  };

  const searchTrends = async (query: string) => {
    const { data, error } = await supabase
      .from('posts')
      .select('tags')
      .not('tags', 'is', null);

    if (!error && data) {
      const tagCounts: Record<string, number> = {};
      data.forEach((post: any) => {
        if (post.tags) {
          post.tags.forEach((tag: string) => {
            if (tag.toLowerCase().includes(query.toLowerCase())) {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
          });
        }
      });

      const trendsList = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      setTrends(trendsList);
    }
  };

  const handleUserClick = (username: string) => {
    navigate(`/profile/${username}`);
    onClose();
  };

  const handlePostClick = (postId: string) => {
    navigate(`/post/${postId}`);
    onClose();
  };

  const handleTrendClick = (tag: string) => {
    setSearchQuery(tag);
    setActiveTab('posts');
  };

  useEffect(() => {
    if (isOpen && searchQuery) {
      performSearch(searchQuery);
    }
  }, [activeTab]);

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="h-full w-full bg-background overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-[201] bg-background/95 backdrop-blur-lg border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="shrink-0"
            >
              <X className="h-5 w-5" />
            </Button>
            
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search users, posts, trends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="posts" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Posts
              </TabsTrigger>
              <TabsTrigger value="trends" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trends
              </TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="mt-4 space-y-2">
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <VideoLoader size="sm" />
                </div>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserClick(user.username)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar_url || undefined} alt={user.name} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white">
                        {user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground">{user.name}</div>
                      <div className="text-sm text-muted-foreground">@{user.username}</div>
                      {user.bio && (
                        <div className="text-sm text-muted-foreground truncate mt-1">
                          {user.bio}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              ) : searchQuery ? (
                <div className="text-center py-12 text-muted-foreground">
                  No users found
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Start typing to search users
                </div>
              )}
            </TabsContent>

            {/* Posts Tab */}
            <TabsContent value="posts" className="mt-4 space-y-2">
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <VideoLoader size="sm" />
                </div>
              ) : posts.length > 0 ? (
                posts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => handlePostClick(post.id)}
                    className="w-full p-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={post.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xs">
                          {post.profiles?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{post.profiles?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(post.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap break-words">
                      {post.content.split(' ').map((word: string, i: number) =>
                        word.startsWith('#') ? <span key={i} className="text-primary font-medium">{word} </span> : word + ' '
                      )}
                    </div>
                  </button>
                ))
              ) : searchQuery ? (
                <div className="text-center py-12 text-muted-foreground">
                  No posts found
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Start typing to search posts
                </div>
              )}
            </TabsContent>

            {/* Trends Tab */}
            <TabsContent value="trends" className="mt-4 space-y-2">
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <VideoLoader size="sm" />
                </div>
              ) : trends.length > 0 ? (
                trends.map((trend) => (
                  <button
                    key={trend.tag}
                    onClick={() => handleTrendClick(trend.tag)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <div className="font-semibold text-foreground">#{trend.tag}</div>
                        <div className="text-sm text-muted-foreground">
                          {trend.count} {trend.count === 1 ? 'post' : 'posts'}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary">{trend.count}</Badge>
                  </button>
                ))
              ) : searchQuery ? (
                <div className="text-center py-12 text-muted-foreground">
                  No trends found
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Start typing to search trends
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default SearchModal;