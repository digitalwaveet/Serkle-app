import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Eye, Heart, MessageCircle, RefreshCw, Send, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { StoryDialog } from '@/components/story/StoryDialog';
import { ActivityProfile, StoryActivitySnapshot, useStoryActivity } from '@/hooks/useStoryActivity';
import { useUser } from '@/contexts/UserContext';
import { storyRelativeTime } from '@/lib/storyMedia';

interface StoryActivityModalProps { isOpen: boolean; onClose: () => void; storyId: string }
type InsightsProps = StoryActivitySnapshot & {
  userId: string; onClose: () => void; isLoading: boolean; isRefreshing: boolean; error: string;
  refetch: () => unknown; sendReply: (receiverId: string, content: string) => Promise<void>;
  loadMore: () => void; hasMoreViewers: boolean; hasMoreMessages: boolean;
};

function PersonAvatar({ profile }: { profile?: ActivityProfile }) {
  return <Avatar className="size-10 shrink-0"><AvatarImage src={profile?.avatar_url || undefined} /><AvatarFallback className="bg-[#efefef] text-[#0095f6] text-xs">{profile?.initials || 'S'}</AvatarFallback></Avatar>;
}

/** Presentational surface also used by the isolated visual QA page. */
export function StoryInsightsContent(props: InsightsProps) {
  const { userId, onClose, viewsCount, likesCount, repliesCount, viewers, messages, isLoading, error, refetch } = props;
  const [chat, setChat] = useState<{ id: string; profile?: ActivityProfile } | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState('');
  const sendLock = useRef(false);
  const conversations = useMemo(() => {
    const grouped = new Map<string, { id: string; profile?: ActivityProfile; content: string; created_at: string }>();
    messages.forEach(message => {
      const id = message.sender_id === userId ? message.receiver_id : message.sender_id;
      if (!grouped.has(id)) grouped.set(id, { id, profile: message.sender_id === userId ? message.receiverProfile : message.profile, content: message.content, created_at: message.created_at });
    });
    return [...grouped.values()];
  }, [messages, userId]);
  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chat || !reply.trim() || sendLock.current) return;
    sendLock.current = true; setSending(true); setReplyError('');
    try { await props.sendReply(chat.id, reply.trim()); setReply(''); }
    catch { setReplyError('Reply not sent. Your message is still here—please try again.'); }
    finally { sendLock.current = false; setSending(false); }
  };
  const close = () => { if (!sending) onClose(); };
  return <StoryDialog title={chat ? 'Story conversation' : 'Story activity'} onClose={close} className="story-insights">
    <div className="story-insights-header">
      <div className="flex items-center gap-3">
        {chat && <button className="studio-icon" aria-label="Back to insights" disabled={sending} onClick={() => { setChat(null); setReply(''); setReplyError(''); }}><ArrowLeft size={18} /></button>}
        <div><h2>{chat?.profile?.name || (chat ? 'Conversation' : 'Story activity')}</h2></div>
      </div>
      <button className="studio-icon" disabled={sending} onClick={close} aria-label="Close insights"><X size={20} /></button>
    </div>
    <div className="story-insights-scroll">
      {error ? <div className="story-error" role="alert"><p>{error}</p><button className="story-secondary mt-3" onClick={() => void refetch()}>Try again</button></div>
        : isLoading ? <div className="py-16"><SerkleLoader size="md" label="Loading story insights" showText /></div>
        : chat ? <>
          <p className="text-xs text-[#737373] mb-3">Private replies about this story.</p>
          <div className="space-y-4 py-3 max-h-[45dvh] overflow-y-auto" role="log" aria-label="Story conversation">
            {messages.filter(message => message.sender_id === chat.id || message.receiver_id === chat.id).slice().reverse().map(message => <div key={message.id} className={message.sender_id === userId ? 'ml-10 text-right' : 'mr-10'}>
              <p className={`inline-block text-left whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm ${message.sender_id === userId ? 'bg-[#0095f6] text-[#ffffff]' : 'bg-[#efefef]'}`}>{message.content}</p>
              <p className="text-[10px] text-[#737373] mt-1">{storyRelativeTime(message.created_at)}</p>
            </div>)}
          </div>
          {props.hasMoreMessages && <button className="story-secondary my-2" disabled={props.isRefreshing} onClick={props.loadMore}>Load older replies</button>}
          <form onSubmit={submitReply} className="mt-4">
            <label htmlFor="story-insight-reply" className="text-xs font-semibold">Your reply</label>
            <div className="flex gap-2 mt-2"><input id="story-insight-reply" maxLength={2000} value={reply} disabled={sending} onChange={event => setReply(event.target.value)} placeholder="Keep the conversation going…" className="min-w-0 flex-1 rounded-2xl bg-[#fafafa] border border-[#dbdbdb] px-4 py-3 text-sm" />
              <button className="story-primary !px-4" aria-label="Send reply" disabled={!reply.trim() || sending}>{sending ? <SerkleLoader size="xs" /> : <Send size={18} />}</button></div>
            {replyError && <p role="alert" className="story-error mt-3">{replyError}</p>}
          </form>
        </> : <>
          <div className="flex justify-between items-center text-xs text-[#737373] pt-4"><span>Only you can see these insights</span><button aria-label="Refresh insights" disabled={props.isRefreshing} className="studio-icon !size-9 !min-h-0" onClick={() => void refetch()}><RefreshCw size={15} /></button></div>
          <div className="story-metrics">
            {[{ Icon: Eye, label: 'Unique viewers', value: viewsCount }, { Icon: Heart, label: 'Likes', value: likesCount }, { Icon: MessageCircle, label: 'Replies received', value: repliesCount }].map(({ Icon, label, value }) => <div key={label} className="story-metric"><Icon size={18} /><strong>{value.toLocaleString()}</strong><span>{label}</span></div>)}
          </div>
          <p className="text-[11px] leading-relaxed text-[#737373] border-b border-[#efefef] pb-5 mb-1">Viewers are counted once per story. Replies exclude your own messages.</p>
          <Tabs defaultValue="viewers">
            <TabsList className="w-full bg-transparent rounded-none h-12 mb-2 border-b border-[#efefef]"><TabsTrigger className="flex-1 rounded-none h-12 bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black" value="viewers">Viewers</TabsTrigger><TabsTrigger className="flex-1 rounded-none h-12 bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black" value="replies">Replies</TabsTrigger></TabsList>
            <TabsContent value="viewers">
              {viewers.length === 0 ? <div className="story-empty"><Eye /><p>No viewers yet.</p><p className="mt-1">Check back after your circle has seen your story.</p></div> : viewers.map(viewer => <div key={viewer.id} className="story-person">
                <PersonAvatar profile={viewer.profile} /><div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{viewer.profile?.name || 'Serkle member'}</p><p className="text-xs text-[#737373] mt-1">{storyRelativeTime(viewer.viewed_at)}</p></div>
                {viewer.hasLiked && <Heart size={17} className="fill-[#ed4956] text-[#ed4956]" aria-label="Liked your story" />}
              </div>)}
              {props.hasMoreViewers && <button className="story-secondary w-full mt-4" disabled={props.isRefreshing} onClick={props.loadMore}>Load more viewers</button>}
            </TabsContent>
            <TabsContent value="replies">
              {conversations.length === 0 ? <div className="story-empty"><MessageCircle /><p>No replies yet.</p><p className="mt-1">Conversations about your story will appear here.</p></div> : conversations.map(conversation => <button key={conversation.id} className="story-person" onClick={() => setChat(conversation)}>
                <PersonAvatar profile={conversation.profile} /><div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{conversation.profile?.name || 'Serkle member'}</p><p className="text-xs text-[#737373] truncate mt-1">{conversation.content}</p></div><ArrowUpRight size={16} />
              </button>)}
              {props.hasMoreMessages && <button className="story-secondary w-full mt-4" disabled={props.isRefreshing} onClick={props.loadMore}>Load more replies</button>}
            </TabsContent>
          </Tabs>
        </>}
    </div>
  </StoryDialog>;
}

function ConnectedInsights({ storyId, onClose }: Omit<StoryActivityModalProps, 'isOpen'>) {
  const { user } = useUser();
  const data = useStoryActivity(storyId);
  return <StoryInsightsContent {...data} userId={user?.id || ''} onClose={onClose} />;
}

export default function StoryActivityModal({ isOpen, ...props }: StoryActivityModalProps) {
  return isOpen ? <ConnectedInsights key={props.storyId} {...props} /> : null;
}
