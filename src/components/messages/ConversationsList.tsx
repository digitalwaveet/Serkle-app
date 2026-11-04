import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Pin, PinOff, MessageCircle, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Conversation, usePinnedConversations, useTogglePin } from '@/hooks/useConversations';
import EmptyState from '@/components/ui/empty-state';
import { usePresence } from '@/hooks/usePresence';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useGlobalTyping } from '@/hooks/useGlobalTyping';

interface ConversationsListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  isLoading: boolean;
  currentUserId: string;
}

const UnreadBadge = ({ count }: { count: number }) => {
  const [animate, setAnimate] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      setAnimate(true);
      const t = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  const display = count > 99 ? '99+' : String(count);

  return (
    <span
      className={`bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center shrink-0 transition-transform ${animate ? 'animate-bounce-in' : ''
        }`}
    >
      {display}
    </span>
  );
};

interface ContextPopup {
  conversation: Conversation;
  isPinned: boolean;
}

const ConversationsList: React.FC<ConversationsListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  isLoading,
  currentUserId,
}) => {
  const { isUserOnline, getLastSeenText } = usePresence(currentUserId);
  const { getUnreadCountForConversation } = useUnreadCount();
  const { getTypingText, isTyping } = useGlobalTyping(
    conversations.map(c => c.conversation_id),
    currentUserId
  );

  const pinnedIds = usePinnedConversations(currentUserId);
  const { togglePin: togglePinAction } = useTogglePin();

  const [contextPopup, setContextPopup] = useState<ContextPopup | null>(null);

  const togglePin = useCallback(async (id: string) => {
    const isCurrentlyPinned = pinnedIds.has(id);
    await togglePinAction(currentUserId, id, !isCurrentlyPinned);
    setContextPopup(null);
  }, [currentUserId, pinnedIds, togglePinAction]);

  // --- Long-press handling ---
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const startLongPress = (e: React.TouchEvent | React.MouseEvent, conversation: Conversation) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setContextPopup({ conversation, isPinned: pinnedIds.has(conversation.conversation_id) });
    }, 500);
  };

  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Sort: pinned first, then by last message time
  const sortedConversations = [...conversations].sort((a, b) => {
    const aPinned = pinnedIds.has(a.conversation_id) ? 1 : 0;
    const bPinned = pinnedIds.has(b.conversation_id) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bTime - aTime;
  });

  if (isLoading) {
    return (
      <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading messages" showText /></div>
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="No Conversations Yet"
        description="Start a conversation by messaging someone from their profile."
        className="h-64 py-0"
      />
    );
  }

  return (
    <div className="relative">
      {sortedConversations.map((conversation) => {
        const isSelected = conversation.conversation_id === selectedConversationId;
        const isLastMessageFromOther = conversation.last_message_sender_id !== currentUserId;
        const unreadCount = getUnreadCountForConversation(conversation.conversation_id);
        const isUnread = unreadCount > 0 && isLastMessageFromOther;
        const isPinned = pinnedIds.has(conversation.conversation_id);

        return (
          <button
            key={conversation.conversation_id}
            onClick={() => {
              if (!longPressTriggered.current) {
                onSelectConversation(conversation.conversation_id);
              }
            }}
            onMouseDown={(e) => startLongPress(e, conversation)}
            onMouseUp={endLongPress}
            onMouseLeave={endLongPress}
            onTouchStart={(e) => startLongPress(e, conversation)}
            onTouchEnd={endLongPress}
            onTouchCancel={endLongPress}
            className={`w-full flex items-center gap-3 p-4 border-b border-border/50 active:bg-muted/70 transition-colors text-left ${isSelected ? 'bg-muted' : 'hover:bg-muted/30'
              } ${isPinned ? 'bg-primary/5' : ''}`}
          >
            <div className="relative">
              <Avatar className="h-14 w-14">
                {conversation.is_group ? (
                  <>
                    <AvatarImage src={conversation.group_avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-accent to-primary text-white text-sm">
                      <Users className="h-6 w-6" />
                    </AvatarFallback>
                  </>
                ) : (
                  <>
                    <AvatarImage src={conversation.other_user_avatar || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-sm">
                      {conversation.other_user_initials}
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
              {!conversation.is_group && isUserOnline(conversation.other_user_id || '') && (
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-success border-2 border-background" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isPinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                  <h3 className={`font-semibold truncate text-base ${isUnread ? 'text-foreground' : 'text-foreground/80'}`}>
                    {conversation.is_group ? conversation.group_name : conversation.other_user_name}
                  </h3>
                  {conversation.is_group ? (
                    <span className="text-xs text-muted-foreground shrink-0">
                      · {conversation.member_count}
                    </span>
                  ) : !isUserOnline(conversation.other_user_id || '') ? (
                    <span className="text-[10px] text-muted-foreground shrink-0 font-normal truncate max-w-[80px]">
                      · {getLastSeenText(conversation.other_user_id || '')?.replace('last seen', '')}
                    </span>
                  ) : null}
                </div>
                {conversation.last_message_at && (
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">
                    {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                {isTyping(conversation.conversation_id) ? (
                  <p className="text-sm truncate flex-1 font-medium text-primary italic animate-pulse">
                    {getTypingText(conversation.conversation_id)}
                  </p>
                ) : (
                  <p className={`text-sm truncate flex-1 ${isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    {conversation.last_message || 'No messages yet'}
                  </p>
                )}
                {isUnread && (
                  <UnreadBadge count={unreadCount} />
                )}
              </div>
            </div>
          </button>
        );
      })}

      {/* Long-Press Context Popup */}
      {contextPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setContextPopup(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Popup Card */}
          <div
            className="relative z-10 bg-background/90 backdrop-blur-2xl border border-border/50 rounded-[28px] shadow-2xl w-[300px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Contact Header */}
            <div className="flex items-center gap-3 p-5 border-b border-border/30">
              <Avatar className="h-12 w-12">
                {contextPopup.conversation.is_group ? (
                  <>
                    <AvatarImage src={contextPopup.conversation.group_avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-accent to-primary text-white text-sm">
                      <Users className="h-5 w-5" />
                    </AvatarFallback>
                  </>
                ) : (
                  <>
                    <AvatarImage src={contextPopup.conversation.other_user_avatar || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-sm">
                      {contextPopup.conversation.other_user_initials}
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">
                  {contextPopup.conversation.is_group
                    ? contextPopup.conversation.group_name
                    : contextPopup.conversation.other_user_name}
                </p>
                {contextPopup.conversation.last_message && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {contextPopup.conversation.last_message}
                  </p>
                )}
              </div>
              <button
                onClick={() => setContextPopup(null)}
                className="p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="p-2">
              <button
                onClick={() => togglePin(contextPopup.conversation.conversation_id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-muted/50 transition-colors text-left"
              >
                {contextPopup.isPinned ? (
                  <>
                    <PinOff className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Unpin from top</span>
                  </>
                ) : (
                  <>
                    <Pin className="h-5 w-5 text-primary" />
                    <span className="font-medium">Pin to top</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setContextPopup(null);
                  onSelectConversation(contextPopup.conversation.conversation_id);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-muted/50 transition-colors text-left"
              >
                <MessageCircle className="h-5 w-5 text-primary" />
                <span className="font-medium">Open Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationsList;
