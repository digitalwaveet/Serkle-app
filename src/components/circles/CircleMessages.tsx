import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Check, CheckCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VideoLoader } from '@/components/ui/VideoLoader';
import { useUser } from '@/contexts/UserContext';
import { useCircleMessages, useSendCircleMessage, useMarkCircleMessagesRead, type CircleMessage } from '@/hooks/useCircleMessages';
import { format } from 'date-fns';

interface CircleMessagesProps {
  circle: any;
  isOwner: boolean;
}

const CircleMessages: React.FC<CircleMessagesProps> = ({ circle, isOwner }) => {
  const { user } = useUser();
  const [newMessage, setNewMessage] = useState('');
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading } = useCircleMessages(circle.id, isOwner);
  const sendMessage = useSendCircleMessage();
  const markRead = useMarkCircleMessagesRead();

  // Group messages by sender for owner's inbox view
  const messagesBySender = React.useMemo(() => {
    const map = new Map<string, CircleMessage[]>();
    messages.forEach(msg => {
      // For owner view, group by non-owner senders
      const key = msg.sender_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(msg);
    });
    return map;
  }, [messages]);

  // Get unique senders (excluding owner) for inbox
  const senderThreads = React.useMemo(() => {
    if (!isOwner) return [];
    const threads: { senderId: string; sender: CircleMessage['sender']; lastMessage: CircleMessage; unread: number }[] = [];

    messagesBySender.forEach((msgs, senderId) => {
      if (senderId === user?.id) return; // skip owner's own messages in thread list
      const senderMsgs = messages.filter(m => m.sender_id === senderId);
      const lastMsg = senderMsgs[senderMsgs.length - 1];
      const unread = senderMsgs.filter(m => !m.is_read).length;
      threads.push({
        senderId,
        sender: lastMsg.sender,
        lastMessage: lastMsg,
        unread,
      });
    });

    return threads.sort((a, b) =>
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [messagesBySender, messages, isOwner, user?.id]);

  // Get messages for selected thread (owner view) or all own messages (member view)
  const visibleMessages = React.useMemo(() => {
    if (!isOwner) return messages;
    if (!selectedSender) return [];
    return messages.filter(
      m => m.sender_id === selectedSender || (m.sender_id === user?.id && messages.some(om => om.sender_id === selectedSender))
    );
  }, [messages, isOwner, selectedSender, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages]);

  // Mark unread as read when owner opens a thread
  useEffect(() => {
    if (!isOwner || !selectedSender) return;
    const unreadIds = messages
      .filter(m => m.sender_id === selectedSender && !m.is_read)
      .map(m => m.id);
    if (unreadIds.length > 0) {
      markRead.mutate({ circleId: circle.id, messageIds: unreadIds });
    }
  }, [selectedSender, messages, isOwner]);

  const handleSend = () => {
    if (!newMessage.trim() || !user) return;
    sendMessage.mutate({
      circleId: circle.id,
      senderId: user.id,
      content: newMessage.trim(),
    });
    setNewMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter creates new line (default behavior), no override needed
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <VideoLoader size="md" label="Loading messages..." />
      </div>
    );
  }

  // MEMBER VIEW: simple chat with the circle
  if (!isOwner) {
    return (
      <div className="flex flex-col h-[500px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <MessageCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Message the Circle</h3>
              <p className="text-sm text-muted-foreground">
                Send a private message to the circle owner. Only you and the owner can see it.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_id === user?.id} />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 flex gap-2 items-end">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message to the circle..."
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // OWNER VIEW: inbox with threads
  return (
    <div className="flex flex-col h-[500px]">
      {!selectedSender ? (
        // Thread list
        <div className="flex-1 overflow-y-auto">
          {senderThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <MessageCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Circle Inbox</h3>
              <p className="text-sm text-muted-foreground">
                Messages from your circle members will appear here.
              </p>
            </div>
          ) : (
            senderThreads.map((thread) => (
              <button
                key={thread.senderId}
                onClick={() => setSelectedSender(thread.senderId)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 text-left"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={thread.sender?.avatar_url || undefined} />
                  <AvatarFallback style={{ backgroundColor: thread.sender?.avatar_color }}>
                    {thread.sender?.initials || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{thread.sender?.name || 'Unknown'}</p>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(thread.lastMessage.created_at), 'MMM d')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{thread.lastMessage.content}</p>
                </div>
                {thread.unread > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-[20px] flex items-center justify-center px-1.5 font-medium">
                    {thread.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        // Thread view
        <>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Button variant="ghost" size="sm" onClick={() => setSelectedSender(null)}>
              ← Back
            </Button>
            <p className="font-medium text-sm">
              {senderThreads.find(t => t.senderId === selectedSender)?.sender?.name || 'Unknown'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {visibleMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_id === user?.id} />
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-border p-3 flex gap-2 items-end">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply..."
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMessage.isPending}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

const MessageBubble: React.FC<{ message: CircleMessage; isOwn: boolean }> = ({ message, isOwn }) => (
  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
    <div className={`flex gap-2 max-w-[80%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isOwn && (
        <Avatar className="h-7 w-7 mt-1">
          <AvatarImage src={message.sender?.avatar_url || undefined} />
          <AvatarFallback className="text-[10px]" style={{ backgroundColor: message.sender?.avatar_color }}>
            {message.sender?.initials || '?'}
          </AvatarFallback>
        </Avatar>
      )}
      <div>
        {!isOwn && (
          <p className="text-[11px] text-muted-foreground mb-0.5 ml-1">{message.sender?.name}</p>
        )}
        <div className={`rounded-[20px] px-[18px] py-[10px] text-[15px] tracking-[-0.01em] shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-3xl backdrop-saturate-200 border ${isOwn
          ? 'bg-gradient-to-tr from-primary/95 to-primary/85 border-white/15 text-white rounded-br-[6px]'
          : 'bg-card/85 dark:bg-[#1C1C1E]/85 border-black/5 dark:border-white/10 text-foreground rounded-bl-[6px]'
          }`}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] opacity-70">
              {format(new Date(message.created_at), 'h:mm a')}
            </span>
            {isOwn && (
              message.is_read
                ? <CheckCheck className="h-3 w-3 text-green-400" />
                : <Check className="h-3 w-3 opacity-50" />
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default CircleMessages;
