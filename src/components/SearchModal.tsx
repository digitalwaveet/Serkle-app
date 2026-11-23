import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  FileText,
  Flame,
  RotateCcw,
  Search,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import './SearchModal.css';

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
  subtitle: string | null;
  is_verified: boolean | null;
}

interface SearchPost {
  id: string;
  content: string;
  created_at: string | null;
  user_id: string;
  circle_id: string | null;
  is_premium: boolean | null;
  profiles: {
    name: string;
    username: string;
    avatar_url: string | null;
    initials: string;
    is_verified: boolean | null;
  } | null;
}

interface Trend {
  tag: string;
  count: number;
}

type SearchTab = 'users' | 'posts' | 'trends';

const tabs: Array<{ value: SearchTab; label: string; icon: React.ElementType }> = [
  { value: 'users', label: 'People', icon: UserRound },
  { value: 'posts', label: 'Posts', icon: FileText },
  { value: 'trends', label: 'Trends', icon: TrendingUp },
];

const cleanSearchTerm = (value: string) => value.replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim();
const cleanTag = (value: string) => value.replace(/^#+/, '').trim();

function SearchSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="serkle-search-skeleton" aria-label="Searching" role="status">
      {Array.from({ length: compact ? 5 : 4 }).map((_, index) => (
        <div className="serkle-search-skeleton-row" key={index}>
          <span className="serkle-search-skeleton-avatar" />
          <span className="serkle-search-skeleton-copy"><span /><span /></span>
        </div>
      ))}
    </div>
  );
}

function ResultEmpty({ tab, query }: { tab: SearchTab; query: string }) {
  const Icon = tab === 'users' ? UserRound : tab === 'posts' ? FileText : TrendingUp;
  const label = tab === 'users' ? 'people' : tab;
  return (
    <div className="serkle-search-empty" role="status">
      <span className="serkle-search-empty-icon"><Icon aria-hidden="true" /></span>
      <h3>No {label} found</h3>
      <p>We couldn’t find anything for <strong>“{query}”</strong>. Try a shorter name, word, or hashtag.</p>
    </div>
  );
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('users');
  const [isSearching, setIsSearching] = useState(false);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const trendTagCache = useRef<string[] | null>(null);
  const navigate = useNavigate();

  const searchUsers = useCallback(async (query: string) => {
    const { data, error: searchError } = await supabase
      .from('profiles')
      .select('id, username, name, avatar_url, initials, bio, subtitle, is_verified')
      .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
      .order('is_verified', { ascending: false })
      .limit(20);
    if (searchError) throw searchError;
    return (data ?? []) as SearchUser[];
  }, []);

  const searchPosts = useCallback(async (query: string) => {
    const { data, error: searchError } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        user_id,
        circle_id,
        is_premium,
        profiles:user_id (name, username, avatar_url, initials, is_verified)
      `)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);
    if (searchError) throw searchError;
    return (data ?? []) as unknown as SearchPost[];
  }, []);

  const searchTrends = useCallback(async (query = '') => {
    if (!trendTagCache.current) {
      const { data, error: searchError } = await supabase
        .from('posts')
        .select('tags')
        .not('tags', 'is', null)
        .limit(2500);
      if (searchError) throw searchError;
      trendTagCache.current = (data ?? []).flatMap((post) => post.tags ?? []);
    }

    const normalizedQuery = query.toLocaleLowerCase();
    const tagCounts = new Map<string, number>();
    trendTagCache.current.forEach((rawTag) => {
      const tag = cleanTag(rawTag);
      if (!tag || (normalizedQuery && !tag.toLocaleLowerCase().includes(normalizedQuery))) return;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });

    return Array.from(tagCounts, ([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 20);
  }, []);

  const performSearch = useCallback(async (rawQuery: string) => {
    const query = cleanSearchTerm(rawQuery);
    const currentRequest = ++requestId.current;

    if (!query) {
      setUsers([]);
      setPosts([]);
      setError(null);
      setIsSearching(true);
      try {
        const popular = await searchTrends();
        if (requestId.current === currentRequest) setTrends(popular);
      } catch (searchError) {
        console.error('Popular trends error:', searchError);
        if (requestId.current === currentRequest) setError('Serkle search could not refresh right now.');
      } finally {
        if (requestId.current === currentRequest) setIsSearching(false);
      }
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const [nextUsers, nextPosts, nextTrends] = await Promise.all([
        searchUsers(query),
        searchPosts(query),
        searchTrends(query),
      ]);
      if (requestId.current !== currentRequest) return;
      setUsers(nextUsers);
      setPosts(nextPosts);
      setTrends(nextTrends);
    } catch (searchError) {
      console.error('Search error:', searchError);
      if (requestId.current === currentRequest) setError('Search results could not be loaded. Check your connection and try again.');
    } finally {
      if (requestId.current === currentRequest) setIsSearching(false);
    }
  }, [searchPosts, searchTrends, searchUsers]);

  useEffect(() => {
    if (!isOpen) {
      requestId.current += 1;
      return;
    }
    const timer = window.setTimeout(() => void performSearch(searchQuery), searchQuery.trim() ? 280 : 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, performSearch, searchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const closeAndNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleTrendClick = (tag: string) => {
    setSearchQuery(tag);
    setActiveTab('posts');
    inputRef.current?.focus();
  };

  const resultCount = (tab: SearchTab) => tab === 'users' ? users.length : tab === 'posts' ? posts.length : trends.length;

  if (!isOpen) return null;

  return createPortal(
    <div className="serkle-search-overlay" role="presentation">
      <section className="serkle-search-shell" role="dialog" aria-modal="true" aria-labelledby="serkle-search-title">
        <header className="serkle-search-header">
          <div className="serkle-search-title-row">
            <button className="serkle-search-icon-button" type="button" onClick={onClose} aria-label="Close search">
              <ArrowLeft aria-hidden="true" />
            </button>
            <div><span className="serkle-search-eyebrow">Discover</span><h2 id="serkle-search-title">Search Serkle</h2></div>
          </div>

          <label className="serkle-search-field">
            <span className="sr-only">Search people, posts and trends</span>
            <Search aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="People, posts, or #topics"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search"><X aria-hidden="true" /></button>}
          </label>

          <div className="serkle-search-tabs" role="tablist" aria-label="Search categories">
            {tabs.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeTab === value}
                className={activeTab === value ? 'is-active' : undefined}
                onClick={() => setActiveTab(value)}
              >
                <Icon aria-hidden="true" /><span>{label}</span>
                {!!searchQuery.trim() && !isSearching && <small>{resultCount(value)}</small>}
              </button>
            ))}
          </div>
        </header>

        <main className="serkle-search-results" aria-live="polite" aria-busy={isSearching}>
          {error ? (
            <div className="serkle-search-error" role="alert">
              <span><RotateCcw aria-hidden="true" /></span><h3>Search needs another try</h3><p>{error}</p>
              <button type="button" onClick={() => void performSearch(searchQuery)}>Try again</button>
            </div>
          ) : isSearching ? <SearchSkeleton compact={activeTab === 'trends'} /> : activeTab === 'users' ? (
            searchQuery.trim() ? users.length ? (
              <div className="serkle-search-list">
                <div className="serkle-search-section-heading"><span>People</span><small>{users.length} found</small></div>
                {users.map((user) => (
                  <button key={user.id} className="serkle-search-person" type="button" onClick={() => closeAndNavigate(`/profile/${user.username}`)}>
                    <Avatar className="serkle-search-avatar"><AvatarImage src={user.avatar_url || undefined} alt="" /><AvatarFallback className="serkle-search-avatar-fallback">{user.initials || user.name.slice(0, 2)}</AvatarFallback></Avatar>
                    <span className="serkle-search-person-copy">
                      <strong>{user.name}{user.is_verified && <BadgeCheck aria-label="Verified" />}</strong>
                      <small>@{user.username}{user.subtitle ? ` · ${user.subtitle}` : ''}</small>
                      {user.bio && <span>{user.bio}</span>}
                    </span>
                    <ArrowUpRight className="serkle-search-row-arrow" aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : <ResultEmpty tab="users" query={searchQuery} /> : (
              <div className="serkle-search-welcome">
                <span className="serkle-search-welcome-icon"><Search aria-hidden="true" /></span><h3>Find your people</h3>
                <p>Search by name or username to discover creators, friends, and experts across Serkle.</p>
                {!!trends.length && <div className="serkle-search-popular"><span><Flame aria-hidden="true" /> Popular now</span><div>{trends.slice(0, 6).map((trend) => <button type="button" key={trend.tag} onClick={() => handleTrendClick(trend.tag)}>#{trend.tag}</button>)}</div></div>}
              </div>
            )
          ) : activeTab === 'posts' ? (
            searchQuery.trim() ? posts.length ? (
              <div className="serkle-search-list">
                <div className="serkle-search-section-heading"><span>Posts</span><small>{posts.length} found</small></div>
                {posts.map((post) => (
                  <button key={post.id} className="serkle-search-post" type="button" onClick={() => closeAndNavigate(`/post/${post.id}`)}>
                    <span className="serkle-search-post-head">
                      <Avatar className="serkle-search-post-avatar"><AvatarImage src={post.profiles?.avatar_url || undefined} alt="" /><AvatarFallback className="serkle-search-post-avatar-fallback">{post.profiles?.initials || post.profiles?.name?.slice(0, 1) || 'S'}</AvatarFallback></Avatar>
                      <span><strong>{post.profiles?.name || 'Serkle member'}{post.profiles?.is_verified && <BadgeCheck aria-label="Verified" />}</strong><small>@{post.profiles?.username || 'member'}{post.created_at ? ` · ${formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: true })}` : ''}</small></span>
                      {post.is_premium && <em>Premium</em>}
                    </span>
                    <span className="serkle-search-post-body">{post.content}</span>
                    <span className="serkle-search-post-foot">Open post <ArrowUpRight aria-hidden="true" /></span>
                  </button>
                ))}
              </div>
            ) : <ResultEmpty tab="posts" query={searchQuery} /> : (
              <div className="serkle-search-welcome"><span className="serkle-search-welcome-icon"><FileText aria-hidden="true" /></span><h3>Search conversations</h3><p>Find posts by a phrase, idea, question, or hashtag without leaving your current page.</p></div>
            )
          ) : trends.length ? (
            <div className="serkle-search-list">
              <div className="serkle-search-section-heading"><span>{searchQuery.trim() ? 'Matching trends' : 'Trending on Serkle'}</span><small>Updated now</small></div>
              <div className="serkle-search-trends">
                {trends.map((trend, index) => (
                  <button key={trend.tag} type="button" onClick={() => handleTrendClick(trend.tag)}>
                    <span className="serkle-search-rank">{String(index + 1).padStart(2, '0')}</span>
                    <span className="serkle-search-trend-copy"><strong>#{trend.tag}</strong><small>{trend.count.toLocaleString()} {trend.count === 1 ? 'post' : 'posts'}</small></span>
                    <span className="serkle-search-trend-icon"><TrendingUp aria-hidden="true" /></span>
                  </button>
                ))}
              </div>
            </div>
          ) : searchQuery.trim() ? <ResultEmpty tab="trends" query={searchQuery} /> : (
            <div className="serkle-search-welcome"><span className="serkle-search-welcome-icon"><TrendingUp aria-hidden="true" /></span><h3>Trends are warming up</h3><p>Popular topics will appear here as the Serkle community starts posting.</p></div>
          )}
        </main>
      </section>
    </div>,
    document.body,
  );
};

export default SearchModal;
