import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookImage, Check, Link2, Search, Send, Share2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useCreateConversation } from '@/hooks/useConversations';
import { toast } from '@/hooks/use-toast';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import {
  buildPostShareUrl,
  copyTextToClipboard,
  formatPostShareMessage,
  shareViaNativeSheet,
} from '@/lib/postShare';

interface RecipientProfile {
  id: string;
  name: string;
  username: string;
  initials: string;
  avatar_url: string | null;
  avatar_color: string;
}

interface PostShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  circleId?: string | null;
  authorName?: string | null;
  postTitle?: string | null;
  onShareConfirmed: () => Promise<void> | void;
  onShareToStory?: () => void;
}

const PostShareModal: React.FC<PostShareModalProps> = ({
  isOpen,
  onClose,
  postId,
  circleId,
  authorName,
  postTitle,
  onShareConfirmed,
  onShareToStory,
}) => {
  const { user } = useUser();
  const { createConversation } = useCreateConversation();
  const [contacts, setContacts] = useState<RecipientProfile[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [search, setSearch] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [sharingNative, setSharingNative] = useState(false);

  const postUrl = buildPostShareUrl(postId, undefined, circleId);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSentTo(new Set());
      setCopied(false);
      setSendingTo(null);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !user?.id) {
      setContacts([]);
      return;
    }

    let cancelled = false;
    const loadContacts = async () => {
      setLoadingContacts(true);
      try {
        const [followingRes, followersRes] = await Promise.all([
          supabase.from('follows').select('following_id').eq('follower_id', user.id),
          supabase.from('follows').select('follower_id').eq('following_id', user.id),
        ]);

        const ids = new Set<string>();
        followingRes.data?.forEach((row) => { if (row.following_id) ids.add(row.following_id); });
        followersRes.data?.forEach((row) => { if (row.follower_id) ids.add(row.follower_id); });
        ids.delete(user.id);

        if (ids.size === 0) {
          if (!cancelled) setContacts([]);
          return;
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, initials, avatar_url, avatar_color')
          .in('id', [...ids])
          .limit(50);

        if (!cancelled) {
          setContacts((profiles as RecipientProfile[]) || []);
        }
      } catch (error) {
        console.error('Error loading share recipients:', error);
        if (!cancelled) setContacts([]);
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    };

    void loadContacts();
    return () => { cancelled = true; };
  }, [isOpen, user?.id]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (person) =>
        person.name.toLowerCase().includes(q) ||
        person.username.toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const handleCopyLink = async () => {
    const ok = await copyTextToClipboard(postUrl);
    if (!ok) {
      toast({ title: 'Could not copy link', variant: 'destructive' });
      return;
    }
    setCopied(true);
    toast({ title: 'Link copied' });
    await onShareConfirmed();
    setTimeout(() => onClose(), 350);
  };

  const handleSendToPerson = async (recipient: RecipientProfile) => {
    if (!user?.id || sendingTo || sentTo.has(recipient.id)) return;
    setSendingTo(recipient.id);
    try {
      const conversationId = await createConversation(user.id, recipient.id);
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: formatPostShareMessage(postUrl, authorName),
      });
      if (error) throw error;

      setSentTo((prev) => new Set(prev).add(recipient.id));
      toast({ title: `Shared with ${recipient.name}` });
      await onShareConfirmed();
    } catch (error) {
      console.error('Error sharing post to friend:', error);
      toast({ title: 'Could not send post', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSendingTo(null);
    }
  };

  const handleNativeShare = async () => {
    if (sharingNative) return;
    setSharingNative(true);
    try {
      const outcome = await shareViaNativeSheet({
        title: postTitle || (authorName ? `${authorName} on Serkle` : 'Post on Serkle'),
        url: postUrl,
      });
      if (outcome === 'shared') {
        await onShareConfirmed();
        onClose();
      } else if (outcome === 'error') {
        toast({ title: 'Could not share', variant: 'destructive' });
      }
    } finally {
      setSharingNative(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-share-title"
    >
      <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px]" aria-hidden="true" />

      <div
        className="relative z-10 flex max-h-[82dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[1.75rem] border border-border/70 bg-background shadow-2xl animate-in slide-in-from-bottom duration-200 sm:rounded-[1.75rem]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 id="post-share-title" className="text-base font-bold text-foreground">Share post</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share sheet"
            className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Send to friends section */}
        {user && (
          <div className="flex min-h-0 flex-1 flex-col border-b border-border/60 px-4 py-3">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Send to a friend..."
                aria-label="Search friends to share with"
                className="h-10 w-full rounded-xl border border-border/80 bg-muted/40 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            {loadingContacts ? (
              <div className="flex items-center justify-center py-6">
                <SerkleLoader size="xs" label="Loading friends" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {contacts.length === 0
                  ? 'Follow people to share posts directly in chat.'
                  : 'No matching friends found.'}
              </p>
            ) : (
              <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                {filteredContacts.map((person) => {
                  const isSent = sentTo.has(person.id);
                  const isSending = sendingTo === person.id;
                  return (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50"
                    >
                      <div
                        className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: person.avatar_color || '#713A20' }}
                      >
                        {person.avatar_url ? (
                          <img src={person.avatar_url} alt={person.name} className="size-full object-cover" />
                        ) : (
                          person.initials
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
                        <p className="truncate text-xs text-muted-foreground">@{person.username}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSendToPerson(person)}
                        disabled={isSent || Boolean(sendingTo)}
                        className={`inline-flex min-h-9 min-w-[76px] items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all disabled:opacity-75 ${
                          isSent
                            ? 'bg-muted text-foreground'
                            : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-95'
                        }`}
                      >
                        {isSending ? (
                          <SerkleLoader size="xs" className="text-current" />
                        ) : isSent ? (
                          <>
                            <Check className="size-3.5" aria-hidden="true" />
                            Sent
                          </>
                        ) : (
                          <>
                            <Send className="size-3.5" aria-hidden="true" />
                            Send
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quick share actions */}
        <div className="flex gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3.5">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex min-h-[72px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/75 bg-muted/35 px-2 py-2.5 transition hover:bg-muted/70 active:scale-[0.98]"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              {copied ? <Check className="size-5" aria-hidden="true" /> : <Link2 className="size-5" aria-hidden="true" />}
            </span>
            <span className="text-xs font-semibold text-foreground">{copied ? 'Copied' : 'Copy link'}</span>
          </button>

          {onShareToStory && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onShareToStory();
              }}
              className="flex min-h-[72px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/75 bg-muted/35 px-2 py-2.5 transition hover:bg-muted/70 active:scale-[0.98]"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <BookImage className="size-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-foreground">Story</span>
            </button>
          )}

          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              disabled={sharingNative}
              className="flex min-h-[72px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/75 bg-muted/35 px-2 py-2.5 transition hover:bg-muted/70 active:scale-[0.98] disabled:opacity-50"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <Share2 className="size-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-foreground">More apps</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default PostShareModal;
