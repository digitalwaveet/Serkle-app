import { SerkleLoader } from "@/components/ui/SerkleLoader";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Send,
  ArrowLeft,
  Plus,
  X,
  Pencil,
  Reply,
  Pin,
  Users,
  Search,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { useMessagingDesktop } from "@/hooks/useMessagingDesktop";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { messageCount } from "@/lib/messagingPresentation";
import MessageBadge from "./MessageBadge";
import "./messages.css";
import MessageDeliveryStatus from "./MessageDeliveryStatus";
import { useVisibleChatEnd } from "@/hooks/useVisibleChatEnd";
import {
  useMessages,
  useSendMessage,
  useOtherUserLastRead,
  useRetryMessage,
} from "@/hooks/useMessages";
import {
  useMessageReactions,
  useEditMessage,
  useDeleteMessage,
  useForwardMessage,
  usePinnedMessage,
} from "@/hooks/useMessageActions";
import { useConversations, Conversation } from "@/hooks/useConversations";
import { formatDistanceToNow } from "date-fns";
import { usePresence } from "@/hooks/usePresence";
import { supabase } from "@/integrations/supabase/client";
import { useLiveQuery } from "dexie-react-hooks";
import { chatDb } from "@/lib/db";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import TelegramAttachmentSheet from "./TelegramAttachmentSheet";
import MediaPreviewModal from "./MediaPreviewModal";
import ChatMediaGalleryModal from "./ChatMediaGalleryModal";
import VoiceRecorder from "./VoiceRecorder";
import MessageBubble from "./MessageBubble";
import MessageActionMenu from "./MessageActionMenu";
import ReactionBar from "./ReactionBar";
import DeleteMessageDialog from "./DeleteMessageDialog";
import ForwardMessageModal from "./ForwardMessageModal";
import MediaGroupMosaic, { MediaItem } from "./MediaGroupMosaic";
import MediaLightbox from "./MediaLightbox";
import CircleInvitationModal from "@/components/circles/CircleInvitationModal";
import GroupInfoModal from "./GroupInfoModal";
import PollMessageBubble from "./PollMessageBubble";
import { useNavigation } from "@/contexts/NavigationContext";

interface ChatViewProps {
  conversation: Conversation;
  currentUserId: string;
  currentUserAvatar?: string | null;
  currentUserInitials: string;
  currentUserName: string;
  onBack: () => void;
}

interface ActiveMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  messageType: string;
  attachmentUrl?: string;
}

const ChatView: React.FC<ChatViewProps> = ({
  conversation,
  currentUserId,
  currentUserAvatar,
  currentUserInitials,
  currentUserName,
  onBack,
}) => {
  const navigate = useNavigate();
  const desktop = useMessagingDesktop();
  const [profileDismissed, setProfileDismissed] = useState(false);
  const { pushModalState } = useNavigation();
  const [messageText, setMessageText] = useState("");
  const draftBeforeEdit = useRef("");
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{
    files: File[];
    type: "photo" | "video";
  } | null>(null);
  const [invitationModalId, setInvitationModalId] = useState<string | null>(
    null,
  );
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const initialLoadRef = useRef(true);

  // Wrapper for state setters that should push history state
  const handleOpenSearch = () => {
    pushModalState("chat-search", () => setIsSearchOpen(false));
    setIsSearchOpen(true);
  };

  const handleOpenAttachments = () => {
    if (attachmentSheetOpen) return;
    pushModalState("chat-attachments", () => setAttachmentSheetOpen(false));
    setAttachmentSheetOpen(true);
  };

  const handleOpenGroupInfo = () => {
    if (desktop) {
      setProfileDismissed(false);
      return;
    }
    pushModalState("chat-group-info", () => setGroupInfoOpen(false));
    setGroupInfoOpen(true);
  };

  const handleOpenGallery = () => {
    if (desktop) {
      setProfileDismissed(false);
      return;
    }
    pushModalState("chat-media-gallery", () => setMediaGalleryOpen(false));
    setMediaGalleryOpen(true);
  };

  // Restore scroll position
  useEffect(() => {
    const savedState = window.history.state;
    if (savedState?.scrollPos && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedState.scrollPos;
    }
  }, [conversation.conversation_id]);

  // Save scroll position before navigating away
  const saveScrollPosition = useCallback(() => {
    if (scrollContainerRef.current) {
      window.history.replaceState(
        {
          ...window.history.state,
          scrollPos: scrollContainerRef.current.scrollTop,
        },
        "",
      );
    }
  }, []);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const searchCache = useRef<Map<string, string[]>>(new Map());

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Unique Scroll State
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [hasNewMessagesScrolledUp, setHasNewMessagesScrolledUp] =
    useState(false);
  const prevMessagesCount = useRef(0);

  const canMarkRead = useVisibleChatEnd(
    scrollContainerRef,
    messagesEndRef,
    conversation.conversation_id,
  );
  const {
    messages,
    isLoading,
    isSyncing,
    hasMore,
    loadMore,
    showMessage,
    error: syncError,
    refetch,
  } = useMessages(conversation.conversation_id, currentUserId, canMarkRead);
  const otherUserLastRead = useOtherUserLastRead(
    conversation.conversation_id,
    conversation.other_user_id,
  );
  const { sendMessageAsync, isSending } = useSendMessage();
  const { totalUnreadCount, isLoading: unreadLoading } = useUnreadCount();
  const sendLock = useRef(false);
  const [sendError, setSendError] = useState("");
  const retryMessage = useRetryMessage();
  const { reactions, toggleReaction } = useMessageReactions(
    conversation.conversation_id,
  );
  const editMessage = useEditMessage();
  const { deleteForMe, deleteForEveryone } = useDeleteMessage();
  const forwardMessage = useForwardMessage();
  const { conversations } = useConversations(currentUserId);
  const { isUserOnline, getLastSeenText } = usePresence(currentUserId);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    conversation.conversation_id,
    currentUserId,
    currentUserName,
  );

  // Interaction state
  const [actionMenu, setActionMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    message: ActiveMessage | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    message: null,
  });
  const [reactionBar, setReactionBar] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    messageId: string;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    messageId: "",
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    message: ActiveMessage | null;
  }>({
    isOpen: false,
    message: null,
  });
  const [forwardModal, setForwardModal] = useState<{
    isOpen: boolean;
    message: ActiveMessage | null;
  }>({
    isOpen: false,
    message: null,
  });
  const [replyTo, setReplyTo] = useState<ActiveMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ActiveMessage | null>(
    null,
  );
  const { pinnedMessage, pinMessage, unpinMessage } = usePinnedMessage(
    conversation.conversation_id,
    messages,
  );
  const [lightbox, setLightbox] = useState<{
    items: MediaItem[];
    index: number;
  } | null>(null);

  const handleOpenLightbox = (items: MediaItem[], index: number) => {
    pushModalState("chat-lightbox", () => setLightbox(null));
    setLightbox({ items, index });
  };

  // Long press handling
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const lastTypingSignal = useRef<number>(0);

  const handleProfileClick = () => {
    if (conversation.is_group) {
      handleOpenGroupInfo();
    } else {
      handleOpenGallery();
    }
  };

  const handleNavigateToProfile = () => {
    if (conversation.other_user_id) {
      saveScrollPosition();
      navigate(`/profile/${conversation.other_user_id}`);
    }
  };

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "instant" : "smooth",
    });
    setHasNewMessagesScrolledUp(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      150;
    setShowScrollToBottom(!isAtBottom);
    if (isAtBottom) {
      setHasNewMessagesScrolledUp(false);
    }

    // Auto-load more when near top
    if (container.scrollTop < 100 && hasMore && !isLoading && !isSyncing) {
      handleLoadMore();
    }
  };

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoading || isSyncing) return;
    if (scrollContainerRef.current) {
      prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
    }
    loadMore();
  }, [hasMore, isLoading, isSyncing, loadMore]);

  // Scroll control: only scroll to bottom if near bottom or it's our own new message
  // Initial scroll and pagination stability
  useEffect(() => {
    if (messages.length > 0) {
      if (initialLoadRef.current) {
        // We'll let the ResizeObserver handle the first scroll to be more accurate
      } else if (
        prevScrollHeightRef.current > 0 &&
        scrollContainerRef.current
      ) {
        // Pagination load: maintain scroll position
        const newScrollHeight = scrollContainerRef.current.scrollHeight;
        const delta = newScrollHeight - prevScrollHeightRef.current;
        if (delta > 0) {
          scrollContainerRef.current.scrollTop += delta;
        }
        prevScrollHeightRef.current = 0;
      } else {
        // Only auto-scroll if we are near the bottom OR the last message is from us
        const container = scrollContainerRef.current;
        if (container) {
          const isNearBottom =
            container.scrollHeight -
              container.scrollTop -
              container.clientHeight <
            150;
          const lastMessage = messages[messages.length - 1];
          const isOurMessage = lastMessage?.sender_id === currentUserId;

          if (isNearBottom || isOurMessage) {
            scrollToBottom(false);
          } else if (messages.length > prevMessagesCount.current) {
            // New messages arrived while we were scrolled up
            setHasNewMessagesScrolledUp(true);
          }
        }
      }
      prevMessagesCount.current = messages.length;
    }
  }, [messages, currentUserId]);

  // Reset initial load flag when conversation changes
  useEffect(() => {
    initialLoadRef.current = true;
  }, [conversation.conversation_id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [messageText]);

  // Focus input when replying or editing
  useEffect(() => {
    if (replyTo || editingMessage) {
      textareaRef.current?.focus();
    }
  }, [replyTo, editingMessage]);

  const getSenderName = (senderId: string) => {
    return senderId === currentUserId
      ? currentUserName
      : messages.find((message) => message.sender_id === senderId)?.sender
          ?.name ||
          (conversation.is_group ? "Member" : conversation.other_user_name);
  };

  const openActionMenu = (x: number, y: number, msg: any) => {
    const msgData = {
      id: msg.id,
      content: msg.content,
      senderId: msg.sender_id,
      senderName: getSenderName(msg.sender_id),
      messageType: (msg as any).message_type || "text",
      attachmentUrl: (msg as any).attachment_url,
    };
    pushModalState("chat-action-menu", () =>
      setActionMenu({ isOpen: false, position: { x: 0, y: 0 }, message: null }),
    );
    setActionMenu({
      isOpen: true,
      position: { x, y },
      message: msgData,
    });
  };

  const handleLongPressStart = (
    e: React.TouchEvent | React.MouseEvent,
    msg: any,
  ) => {
    longPressTriggered.current = false;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      openActionMenu(clientX, clientY, msg);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleSendMessage = async () => {
    if (
      !messageText.trim() ||
      sendLock.current ||
      isSending ||
      editMessage.isPending
    )
      return;
    sendLock.current = true;
    setSendError("");
    stopTyping();
    lastTypingSignal.current = 0;
    try {
      if (editingMessage) {
        await editMessage.mutateAsync({
          messageId: editingMessage.id,
          content: messageText.trim(),
          conversationId: conversation.conversation_id,
        });
        setEditingMessage(null);
        setMessageText(draftBeforeEdit.current);
      } else {
        await sendMessageAsync({
          conversationId: conversation.conversation_id,
          senderId: currentUserId,
          content: messageText.trim(),
          replyToId: replyTo?.id,
        });
        setReplyTo(null);
        setMessageText("");
      }
    } catch {
      setSendError(
        "Your message could not be saved. Your text is still here; please try again.",
      );
    } finally {
      sendLock.current = false;
    }
  };

  const handleSendAttachment = async (
    type: string,
    url: string,
    label: string,
    id?: string,
  ) => {
    setSendError("");
    await sendMessageAsync({
      conversationId: conversation.conversation_id,
      senderId: currentUserId,
      content: label,
      messageType: type,
      attachmentUrl: url,
      id,
    });
  };

  const handleMediaSelected = (files: File[], type: "photo" | "video") => {
    setMediaPreview({ files, type });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Enter creates new line (default behavior), no override needed
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    const trimmed = e.target.value.trim();
    if (trimmed) {
      const now = Date.now();
      if (now - lastTypingSignal.current > 1000) {
        startTyping();
        lastTypingSignal.current = now;
      }
    } else {
      stopTyping();
      lastTypingSignal.current = 0;
    }
  };

  // Action handlers
  const handleReply = () => {
    if (actionMenu.message) {
      window.history.back();
      setReplyTo(actionMenu.message);
      if (editingMessage) setMessageText(draftBeforeEdit.current);
      setEditingMessage(null);
    }
  };

  const handleCopy = async () => {
    if (actionMenu.message) {
      try {
        await navigator.clipboard.writeText(actionMenu.message.content);
        window.history.back();
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Text could not be copied. Please try again.");
      }
    }
  };

  const handleEdit = () => {
    if (actionMenu.message) {
      window.history.back();
      if (!editingMessage) draftBeforeEdit.current = messageText;
      setEditingMessage(actionMenu.message);
      setMessageText(actionMenu.message.content);
      setReplyTo(null);
    }
  };

  const handleDelete = () => {
    if (actionMenu.message) {
      window.history.back();
      setTimeout(() => {
        pushModalState("chat-delete-dialog", () =>
          setDeleteDialog({ isOpen: false, message: null }),
        );
        setDeleteDialog({ isOpen: true, message: actionMenu.message });
      }, 100);
    }
  };

  const handleForward = () => {
    if (actionMenu.message) {
      window.history.back();
      setTimeout(() => {
        pushModalState("chat-forward-modal", () =>
          setForwardModal({ isOpen: false, message: null }),
        );
        setForwardModal({ isOpen: true, message: actionMenu.message });
      }, 100);
    }
  };

  const handleReact = () => {
    if (actionMenu.message) {
      window.history.back();
      setTimeout(() => {
        pushModalState("chat-reaction-bar", () =>
          setReactionBar({
            isOpen: false,
            position: { x: 0, y: 0 },
            messageId: "",
          }),
        );
        setReactionBar({
          isOpen: true,
          position: actionMenu.position,
          messageId: actionMenu.message!.id,
        });
      }, 100);
    }
  };

  const handlePin = async () => {
    if (actionMenu.message) {
      try {
        if (pinnedMessage?.id === actionMenu.message.id) {
          await unpinMessage();
        } else {
          await pinMessage(actionMenu.message.id);
        }
        window.history.back();
      } catch {
        /* The mutation reports the failure and keeps the menu open. */
      }
    }
  };

  const scrollToMessage = async (messageId: string) => {
    try {
      await showMessage(messageId);
      for (let attempt = 0; attempt < 20; attempt++) {
        const el = messageRefs.current.get(messageId);
        if (!el) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          continue;
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("bg-primary/10");
        setTimeout(() => el.classList.remove("bg-primary/10"), 1500);
        return;
      }
      throw new Error("Message unavailable");
    } catch {
      toast.error("This message could not be opened. Please try again.");
    }
  };
  const [searchParams] = useSearchParams();
  const targetMessageId = searchParams.get("messageId");
  useEffect(() => {
    if (
      !isLoading &&
      targetMessageId &&
      /^[0-9a-f-]{36}$/i.test(targetMessageId)
    )
      void scrollToMessage(targetMessageId);
  }, [targetMessageId, isLoading, conversation.conversation_id]);

  // Search functionality
  useEffect(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    if (!query || query.length < 2 || !isSearchOpen) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    // Check cache first
    if (searchCache.current.has(query)) {
      const cached = searchCache.current.get(query)!;
      setSearchResults(cached);
      if (cached.length > 0 && currentSearchIndex === -1) {
        setCurrentSearchIndex(cached.length - 1);
      }
      // Note: we still might want to re-run if 'messages' changed significantly,
      // but for performance we can keep the cache.
      return;
    }

    const performSearch = async () => {
      // 1. Local filter on loaded messages for immediate feedback
      const localResults = messages
        .filter((m: any) => m.content?.toLowerCase().includes(query))
        .map((m: any) => m.id);

      // 2. Server-side search for deeper history (if query is specific enough)
      if (query.length > 3) {
        try {
          const { data, error } = await supabase
            .from("messages")
            .select("id")
            .eq("conversation_id", conversation.conversation_id)
            .ilike("content", `%${query}%`)
            .order("created_at", { ascending: false })
            .limit(50);

          if (data && !error) {
            const serverIds = data.map((m) => m.id);
            // Merge results
            const combined = [...new Set([...localResults, ...serverIds])];
            setSearchResults(combined);
            searchCache.current.set(query, combined);
            if (combined.length > 0 && currentSearchIndex === -1) {
              setCurrentSearchIndex(combined.length - 1);
            }
          } else {
            setSearchResults(localResults);
          }
        } catch (e) {
          console.error("[Search] Server fallback failed:", e);
          setSearchResults(localResults);
        }
      } else {
        setSearchResults(localResults);
      }
    };

    performSearch();
  }, [
    debouncedSearchQuery,
    isSearchOpen,
    conversation.conversation_id,
    messages,
  ]);

  // Clear cache when search is closed or conversation changes
  useEffect(() => {
    if (!isSearchOpen) {
      searchCache.current.clear();
    }
  }, [isSearchOpen, conversation.conversation_id]);

  useEffect(() => {
    if (currentSearchIndex >= 0 && searchResults[currentSearchIndex]) {
      scrollToMessage(searchResults[currentSearchIndex]);
    }
  }, [currentSearchIndex, searchResults]);

  const handleSearchNext = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
  };

  const handleSearchPrev = () => {
    if (searchResults.length === 0) return;
    const prevIndex =
      (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
  };

  // Get reactions for a message
  const getMessageReactions = (messageId: string) => {
    return reactions.filter((r: any) => r.message_id === messageId);
  };

  // Find reply-to message content
  const getReplyMessage = (replyToId: string | null) => {
    if (!replyToId) return null;
    const msg = messages.find((m) => m.id === replyToId);
    if (!msg) return null;
    const msgType = (msg as any).message_type || "text";
    let displayContent = msg.content;
    if (msgType === "photo") displayContent = msg.content || "📷 Photo";
    else if (msgType === "video") displayContent = msg.content || "🎥 Video";
    else if (msgType === "voice") displayContent = "🎤 Voice message";
    else if (msgType === "location") displayContent = "📍 Location";
    return {
      senderName: getSenderName(msg.sender_id),
      content: displayContent,
      id: msg.id,
    };
  };

  // Swipe-to-reply handling
  const swipeState = useRef<{ startX: number; messageData: any } | null>(null);

  const handleSwipeStart = (e: React.TouchEvent, msg: any) => {
    swipeState.current = { startX: e.touches[0].clientX, messageData: msg };
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (!swipeState.current) return;
    const dx = e.changedTouches[0].clientX - swipeState.current.startX;
    if (dx > 80) {
      const msg = swipeState.current.messageData;
      setReplyTo({
        id: msg.id,
        content: msg.content,
        senderId: msg.sender_id,
        senderName: getSenderName(msg.sender_id),
        messageType: (msg as any).message_type || "text",
        attachmentUrl: (msg as any).attachment_url,
      });
    }
    swipeState.current = null;
  };

  // Filter out deleted messages
  const visibleMessages = useMemo(
    () => messages.filter((msg: any) => !msg.deleted_for_everyone),
    [messages],
  );

  // Compute the first unread message ID for the "New Messages" divider
  // Read current user's own read receipt from Dexie to find where unread begins
  const myReadReceipt = useLiveQuery(async () => {
    if (!conversation.conversation_id || !currentUserId) return null;
    return chatDb.read_receipts
      .where("[conversation_id+user_id]")
      .equals([conversation.conversation_id, currentUserId])
      .first();
  }, [conversation.conversation_id, currentUserId]);

  const firstUnreadMessageId = useMemo(() => {
    if (!visibleMessages.length || !currentUserId || !myReadReceipt)
      return null;
    const myLastReadSeq = myReadReceipt.last_read_seq || 0;
    if (myLastReadSeq === 0) return null;

    // Find the first message from another user whose seq > our last read position
    for (const msg of visibleMessages) {
      const m = msg as any;
      if (
        m.sender_id !== currentUserId &&
        (m.created_seq ?? m.seq ?? 0) > myLastReadSeq
      ) {
        return m.id;
      }
    }
    return null;
  }, [visibleMessages, currentUserId, myReadReceipt]);

  // Group consecutive media messages from same sender
  type MessageGroup =
    | { type: "single"; message: any }
    | { type: "media_group"; messages: any[]; senderId: string };

  const groupedMessages = useMemo(() => {
    const groups: MessageGroup[] = [];

    for (let i = 0; i < visibleMessages.length; i++) {
      const msg = visibleMessages[i];
      const msgType = (msg as any).message_type || "text";
      const isMedia =
        (msgType === "photo" || msgType === "video") &&
        (msg as any).attachment_url;

      if (isMedia) {
        // Look ahead for consecutive media from same sender
        const mediaGroup = [msg];
        let j = i + 1;
        while (j < visibleMessages.length) {
          const nextMsg = visibleMessages[j];
          const nextType = (nextMsg as any).message_type || "text";
          const nextIsMedia =
            (nextType === "photo" || nextType === "video") &&
            (nextMsg as any).attachment_url;
          if (nextIsMedia && nextMsg.sender_id === msg.sender_id) {
            // Check if sent within 60 seconds of previous
            const timeDiff = Math.abs(
              new Date(nextMsg.created_at).getTime() -
                new Date(
                  mediaGroup[mediaGroup.length - 1].created_at,
                ).getTime(),
            );
            if (timeDiff < 60000) {
              mediaGroup.push(nextMsg);
              j++;
            } else break;
          } else break;
        }

        if (mediaGroup.length > 1) {
          groups.push({
            type: "media_group",
            messages: mediaGroup,
            senderId: msg.sender_id,
          });
          i = j - 1; // Skip grouped messages
        } else {
          groups.push({ type: "single", message: msg });
        }
      } else {
        groups.push({ type: "single", message: msg });
      }
    }
    return groups;
  }, [visibleMessages]);

  // ResizeObserver for stable initial scroll (Wait for layout/images)
  useEffect(() => {
    if (!scrollContentRef.current) return;

    const observer = new ResizeObserver(() => {
      if (initialLoadRef.current && messages.length > 0) {
        scrollToBottom(true);
        // We set initialLoadRef to false after some time to allow images to pop in
        // or once the user manually scrolls. For now, let's give it a small grace period.
        const timer = setTimeout(() => {
          initialLoadRef.current = false;
        }, 1000);
        return () => clearTimeout(timer);
      }
    });

    observer.observe(scrollContentRef.current);
    return () => observer.disconnect();
  }, [messages.length]);

  const hasText = messageText.trim().length > 0;

  return (
    <div className="msg-ui msg-chat" data-testid="chat-view">
      {/* Header */}
      <div className="msg-chat-header flex-none sticky top-0 z-10">
        {!isSearchOpen ? (
          <div className="flex items-center gap-2">
            <span className="msg-chat-back">
              <button
                className="msg-icon"
                aria-label="Back to conversations"
                onClick={onBack}
              >
                <ArrowLeft aria-hidden="true" />
              </button>
              <MessageBadge
                count={unreadLoading ? undefined : totalUnreadCount}
              />
            </span>
            <button
              className="msg-icon"
              aria-label={
                conversation.is_group
                  ? "Open group profile"
                  : "Open contact profile"
              }
              onClick={handleProfileClick}
            >
              <Avatar className="msg-avatar h-10 w-10 rounded-xl">
                <AvatarImage
                  src={
                    (conversation.is_group
                      ? conversation.group_avatar_url
                      : conversation.other_user_avatar) || undefined
                  }
                  alt=""
                />
                <AvatarFallback className="msg-avatar">
                  {conversation.is_group ? (
                    <Users className="size-5" aria-hidden="true" />
                  ) : (
                    conversation.other_user_initials
                  )}
                </AvatarFallback>
              </Avatar>
            </button>
            <button className="msg-chat-title" onClick={handleProfileClick}>
              <h2>
                {conversation.is_group
                  ? conversation.group_name || "Group conversation"
                  : conversation.other_user_name}
              </h2>
              <p>
                {conversation.is_group
                  ? messageCount(conversation.member_count, "member")
                  : conversation.other_user_id &&
                      isUserOnline(conversation.other_user_id)
                    ? "Online"
                    : getLastSeenText(conversation.other_user_id || "") ||
                      "Presence unavailable"}
              </p>
            </button>
            <button
              className="msg-icon"
              aria-label="Search conversation"
              onClick={handleOpenSearch}
            >
              <Search aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-3 py-2 safe-top">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close message search"
                onClick={() => window.history.back()}
                className="-ml-2 h-10 w-10 active:scale-95 transition-transform text-muted-foreground hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 relative">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  aria-label="Search messages"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 bg-muted/50 rounded-full px-4 text-sm outline-none focus:bg-muted/80 transition-colors"
                />
              </div>
            </div>
            {searchQuery && (
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="text-xs text-muted-foreground">
                  {searchResults.length > 0
                    ? `${currentSearchIndex + 1} of ${searchResults.length} results`
                    : "No results found"}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:bg-muted"
                    onClick={handleSearchPrev}
                    aria-label="Previous search result"
                    disabled={searchResults.length === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:bg-muted"
                    onClick={handleSearchNext}
                    aria-label="Next search result"
                    disabled={searchResults.length === 0}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pinned Message Banner */}
        {pinnedMessage && (
          <div
            className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border cursor-pointer hover:bg-muted/70 transition-colors"
            onClick={() => scrollToMessage(pinnedMessage.id)}
          >
            <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
            <button
              className="flex-1 min-w-0 text-left"
              aria-label="View pinned message"
              onClick={(event) => {
                event.stopPropagation();
                void scrollToMessage(pinnedMessage.id);
              }}
            >
              <p className="text-[10px] font-semibold text-primary">
                Pinned Message
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {pinnedMessage.content}
              </p>
            </button>
            <button
              aria-label="Unpin message"
              onClick={(e) => {
                e.stopPropagation();
                void unpinMessage().catch(() => undefined);
              }}
              className="shrink-0 h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      {syncError && (
        <div
          role="alert"
          className="msg-sync-error flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2 text-sm"
        >
          <span>
            Messages couldn’t refresh. Your saved messages are still available.
          </span>
          <Button
            variant="ghost"
            disabled={isSyncing}
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        </div>
      )}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="msg-chat-main flex-1 overflow-y-auto overscroll-contain relative min-h-0"
      >
        <div
          ref={scrollContentRef}
          className="msg-chat-scroll space-y-3 min-h-full flex flex-col justify-end"
        >
          {hasMore && (
            <div className="flex justify-center pt-2 pb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                className="text-xs text-muted-foreground hover:bg-muted font-medium"
                disabled={isLoading || isSyncing}
              >
                {isLoading || isSyncing ? (
                  <SerkleLoader size="xs" className="text-current mr-1" />
                ) : null}
                Load older messages
              </Button>
            </div>
          )}
          {/* Floating Scroll to Bottom Button */}
          {showScrollToBottom && (
            <div className="fixed bottom-24 right-4 z-20 animate-in fade-in zoom-in duration-200">
              <Button
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg relative bg-background border border-border hover:bg-muted text-foreground"
                onClick={() => scrollToBottom(false)}
              >
                <ChevronDown className="h-5 w-5" />
                {hasNewMessagesScrolledUp && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full border-2 border-background animate-pulse" />
                )}
              </Button>
            </div>
          )}
          {isLoading || (isSyncing && visibleMessages.length === 0) ? (
            <div className="min-h-48 w-full flex items-center justify-center py-8">
              <SerkleLoader label="Loading messages" showText />
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center px-4">
              <div className="animate-fade-in">
                <p className="text-muted-foreground text-sm">
                  No messages yet. Start the conversation!
                </p>
              </div>
            </div>
          ) : (
            groupedMessages.map((group, groupIdx) => {
              // Determine the leading message ID for this group
              const groupLeadId =
                group.type === "media_group"
                  ? group.messages[0].id
                  : group.message.id;

              // --- NEW MESSAGES DIVIDER ---
              const showUnreadDivider =
                firstUnreadMessageId && groupLeadId === firstUnreadMessageId;

              const dividerElement = showUnreadDivider ? (
                <div
                  key="unread-divider"
                  className="flex items-center gap-3 py-2 px-2 animate-fade-in"
                >
                  <div className="flex-1 h-px bg-primary/30" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider shrink-0">
                    New Messages
                  </span>
                  <div className="flex-1 h-px bg-primary/30" />
                </div>
              ) : null;

              // --- MEDIA GROUP ---
              if (group.type === "media_group") {
                const msgs = group.messages;
                const isOwn = group.senderId === currentUserId;
                const lastMsg = msgs[msgs.length - 1];
                const mediaItems: MediaItem[] = msgs.map((m: any) => ({
                  id: m.id,
                  url: m.attachment_url,
                  type: (m.message_type || "photo") as "photo" | "video",
                  caption: m.content,
                }));
                const timestamp = formatDistanceToNow(
                  new Date(lastMsg.created_at),
                  { addSuffix: true },
                );

                return (
                  <React.Fragment key={`group-${msgs[0].id}`}>
                    {dividerElement}
                    <div
                      ref={(el) => {
                        if (el) messageRefs.current.set(lastMsg.id, el);
                      }}
                      className={`msg-message-row flex gap-2 animate-fade-in ${isOwn ? "justify-end" : "justify-start"}`}
                      onTouchStart={(e) => {
                        handleLongPressStart(e, lastMsg);
                        handleSwipeStart(e, lastMsg);
                      }}
                      onTouchEnd={(e) => {
                        handleLongPressEnd();
                        handleSwipeEnd(e);
                      }}
                      onTouchMove={handleLongPressEnd}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openActionMenu(e.clientX, e.clientY, lastMsg);
                      }}
                    >
                      {!isOwn && (
                        <Avatar className="msg-message-avatar h-8 w-8 shrink-0 mt-1">
                          <AvatarImage
                            src={
                              msgs[0].sender?.avatar_url ||
                              conversation.other_user_avatar ||
                              undefined
                            }
                          />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xs">
                            {msgs[0].sender?.initials ||
                              conversation.other_user_initials}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[75%] lg:max-w-[75%] min-w-0`}
                      >
                        {conversation.is_group && !isOwn && (
                          <span className="text-xs font-semibold text-primary mb-1">
                            {getSenderName(group.senderId)}
                          </span>
                        )}
                        <div
                          className={`rounded-xl shadow-sm overflow-hidden ${
                            isOwn
                              ? "bg-primary rounded-br-md text-white"
                              : "bg-muted rounded-bl-md"
                          }`}
                        >
                          <MediaGroupMosaic
                            items={mediaItems}
                            isOwn={isOwn}
                            timestamp={timestamp}
                            onOpenLightbox={(index) =>
                              handleOpenLightbox(mediaItems, index)
                            }
                          />
                          {(() => {
                            const groupCaption = mediaItems.find(
                              (mi) =>
                                mi.caption &&
                                mi.caption !== "📷 Photo" &&
                                mi.caption !== "🎥 Video",
                            )?.caption;
                            return groupCaption ? (
                              <p
                                className={`px-3 pt-2 pb-1.5 text-[14px] whitespace-pre-wrap break-words ${
                                  isOwn ? "text-foreground" : "text-foreground"
                                }`}
                                dir="auto"
                                style={{ overflowWrap: "anywhere" }}
                              >
                                {groupCaption}
                              </p>
                            ) : null;
                          })()}
                        </div>
                        <div className="msg-message-meta flex flex-wrap gap-1">
                          {msgs.map((item, index) => (
                            <button
                              key={item.id}
                              className="msg-icon"
                              aria-label={`Actions for attachment ${index + 1}`}
                              onClick={(event) => {
                                const rect =
                                  event.currentTarget.getBoundingClientRect();
                                openActionMenu(rect.x, rect.y, item);
                              }}
                            >
                              <span className="text-xs">{index + 1}</span>
                              <MoreHorizontal
                                aria-hidden="true"
                                className="size-4"
                              />
                            </button>
                          ))}
                        </div>
                        {isOwn && (
                          <div
                            className="mt-1 flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground"
                            aria-label="Attachment send statuses"
                          >
                            {msgs.map((item, index) => (
                              <span
                                key={item.id}
                                className="inline-flex items-center gap-1"
                              >
                                <span className="sr-only">
                                  Attachment {index + 1}:{" "}
                                </span>
                                <MessageDeliveryStatus
                                  syncStatus={item.sync_status}
                                  seq={item.seq}
                                  lastReadSeq={
                                    conversation.is_group
                                      ? 0
                                      : otherUserLastRead
                                  }
                                  retrying={retryMessage.isPending}
                                  onRetry={() => retryMessage.mutate(item.id)}
                                />
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {isOwn && (
                        <Avatar className="msg-message-avatar h-8 w-8 shrink-0 mt-1">
                          <AvatarImage src={currentUserAvatar || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xs">
                            {currentUserInitials}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </React.Fragment>
                );
              }

              // --- SINGLE MESSAGE (unchanged logic) ---
              const message = group.message;
              const isOwn = message.sender_id === currentUserId;
              const msgType = (message as any).message_type || "text";
              const hasMedia =
                msgType !== "text" && (message as any).attachment_url;
              const msgReactions = getMessageReactions(message.id);
              const replyMsg = getReplyMessage((message as any).reply_to_id);
              const isEdited = (message as any).is_edited;
              const forwardedFrom = (message as any).forwarded_from_name;

              // For single photo/video, enable lightbox too
              const singleMediaItem: MediaItem | null =
                (msgType === "photo" || msgType === "video") &&
                (message as any).attachment_url
                  ? {
                      id: message.id,
                      url: (message as any).attachment_url,
                      type: msgType as "photo" | "video",
                      caption: message.content,
                    }
                  : null;

              return (
                <React.Fragment key={message.id}>
                  {dividerElement}
                  <div
                    ref={(el) => {
                      if (el) messageRefs.current.set(message.id, el);
                    }}
                    data-testid={`message-${message.id}`}
                    className={`msg-message-row flex gap-2 relative transition-colors duration-500 rounded-xl ${isOwn ? "justify-end" : "justify-start"}`}
                    onTouchStart={(e) => {
                      handleLongPressStart(e, message);
                      handleSwipeStart(e, message);
                    }}
                    onTouchEnd={(e) => {
                      handleLongPressEnd();
                      handleSwipeEnd(e);
                    }}
                    onTouchMove={handleLongPressEnd}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openActionMenu(e.clientX, e.clientY, message);
                    }}
                  >
                    {!isOwn && (
                      <Avatar className="msg-message-avatar h-8 w-8 shrink-0 mt-1">
                        <AvatarImage
                          src={
                            message.sender?.avatar_url ||
                            conversation.other_user_avatar ||
                            undefined
                          }
                        />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xs">
                          {message.sender?.initials ||
                            conversation.other_user_initials}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={`msg-message-column flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                    >
                      {conversation.is_group && !isOwn && (
                        <span className="text-xs font-semibold text-primary mb-1">
                          {getSenderName(message.sender_id)}
                        </span>
                      )}
                      {forwardedFrom && (
                        <span className="text-[11px] text-muted-foreground italic mb-0.5 px-1">
                          Forwarded from {forwardedFrom}
                        </span>
                      )}

                      <div
                        className={`msg-message-bubble ${isOwn ? "own" : ""} overflow-hidden ${
                          hasMedia
                            ? isOwn
                              ? "bg-primary text-white rounded-br-[6px]"
                              : "bg-card/95 dark:bg-[#1C1C1E]/95 backdrop-blur-3xl border border-black/5 dark:border-white/10 text-foreground rounded-bl-[6px]"
                            : isOwn
                              ? "bg-primary text-white rounded-br-[4px] px-[18px] py-[10px] tracking-[0.01em]"
                              : "bg-card/95 dark:bg-[#1C1C1E]/95 backdrop-blur-3xl border border-black/5 dark:border-white/10 text-foreground rounded-bl-[4px] px-[18px] py-[10px] tracking-[0.01em]"
                        } ${hasMedia ? "p-1" : ""} `}
                      >
                        {replyMsg && (
                          <div
                            className={`mb-1 px-3 py-1.5 rounded-lg cursor-pointer text-xs border-l-2 max-w-full overflow-hidden ${
                              isOwn
                                ? "bg-primary-foreground/10 border-primary-foreground/40"
                                : "bg-primary/10 border-primary/40"
                            }`}
                            onClick={() => scrollToMessage(replyMsg.id)}
                          >
                            <p
                              className={`font-semibold truncate ${isOwn ? "text-primary-foreground/80" : "text-primary"}`}
                            >
                              {replyMsg.senderName}
                            </p>
                            <p
                              className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-10 overflow-hidden ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}
                            >
                              {replyMsg.content}
                            </p>
                          </div>
                        )}

                        <div className={hasMedia ? "p-0" : ""}>
                          {msgType === "poll" &&
                          (message as any).attachment_url ? (
                            <PollMessageBubble
                              pollId={(message as any).attachment_url}
                              isOwn={isOwn}
                              currentUserId={currentUserId}
                            />
                          ) : (
                            <MessageBubble
                              content={message.content}
                              messageType={msgType}
                              attachmentUrl={(message as any).attachment_url}
                              onOpenMedia={
                                singleMediaItem
                                  ? () =>
                                      handleOpenLightbox([singleMediaItem], 0)
                                  : undefined
                              }
                              isOwn={isOwn}
                              onInvitationClick={(id) =>
                                setInvitationModalId(id)
                              }
                            />
                          )}
                        </div>

                        {isEdited && (
                          <p
                            className={`text-[10px] mt-0.5 ${isOwn ? "text-primary-foreground/50" : "text-muted-foreground/70"}`}
                          >
                            edited
                          </p>
                        )}
                      </div>

                      {msgReactions.length > 0 && (
                        <div
                          className={`flex flex-wrap gap-1 -mt-2.5 relative z-[1] ${isOwn ? "justify-end pr-2" : "justify-start pl-2"}`}
                        >
                          {Object.entries(
                            msgReactions.reduce(
                              (
                                acc: Record<
                                  string,
                                  { count: number; userReacted: boolean }
                                >,
                                r: any,
                              ) => {
                                if (!acc[r.emoji])
                                  acc[r.emoji] = {
                                    count: 0,
                                    userReacted: false,
                                  };
                                acc[r.emoji].count++;
                                if (r.user_id === currentUserId)
                                  acc[r.emoji].userReacted = true;
                                return acc;
                              },
                              {} as Record<
                                string,
                                { count: number; userReacted: boolean }
                              >,
                            ),
                          ).map(([emoji, data]) => (
                            <button
                              key={emoji}
                              aria-label={`React with ${emoji}, ${(data as any).count} reactions`}
                              aria-pressed={(data as any).userReacted}
                              disabled={toggleReaction.isPending}
                              onClick={() =>
                                void toggleReaction
                                  .mutateAsync({
                                    messageId: message.id,
                                    userId: currentUserId,
                                    emoji,
                                  })
                                  .catch(() =>
                                    toast.error(
                                      "Reaction could not be saved. Please try again.",
                                    ),
                                  )
                              }
                              className={`inline-flex items-center gap-0.5 text-sm px-1.5 py-0.5 rounded-full border shadow-sm transition-all active:scale-95 ${
                                (data as any).userReacted
                                  ? "bg-primary/15 border-primary/40 shadow-primary/10"
                                  : "bg-background border-border"
                              }`}
                            >
                              <span className="text-base leading-none">
                                {emoji}
                              </span>
                              {(data as any).count > 1 && (
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  {(data as any).count}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      <span className="msg-message-meta mt-1 px-1 flex items-center gap-1">
                        {formatDistanceToNow(new Date(message.created_at), {
                          addSuffix: true,
                        })}
                        {isOwn && (
                          <MessageDeliveryStatus
                            syncStatus={message.sync_status}
                            seq={message.seq}
                            lastReadSeq={
                              conversation.is_group ? 0 : otherUserLastRead
                            }
                            retrying={retryMessage.isPending}
                            onRetry={() => retryMessage.mutate(message.id)}
                          />
                        )}
                        <button
                          className="msg-icon"
                          aria-label={`Actions for ${isOwn ? "your" : "incoming"} message`}
                          onClick={(event) => {
                            const rect =
                              event.currentTarget.getBoundingClientRect();
                            openActionMenu(rect.x, rect.y, message);
                          }}
                        >
                          <MoreHorizontal
                            className="size-4"
                            aria-hidden="true"
                          />
                        </button>
                      </span>
                    </div>

                    {isOwn && (
                      <Avatar className="msg-message-avatar h-8 w-8 shrink-0 mt-1">
                        <AvatarImage src={currentUserAvatar || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xs">
                          {currentUserInitials}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} className="h-px" aria-hidden="true" />
        </div>
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="msg-typing px-4 py-2 flex items-center gap-2">
          {/* Animated typing dots */}
          <div className="flex items-center gap-[3px]">
            <span
              className="w-[6px] h-[6px] rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-[6px] h-[6px] rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-[6px] h-[6px] rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span className="text-sm text-muted-foreground italic">
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing`
              : typingUsers.length === 2
                ? `${typingUsers[0]} and ${typingUsers[1]} are typing`
                : `${typingUsers.length} people are typing`}
          </span>
        </div>
      )}

      {/* Message Input */}
      <div className="msg-composer">
        {sendError && (
          <p className="msg-error mx-3" role="alert">
            {sendError}
          </p>
        )}
        {/* Reply / Edit preview bar */}
        {(replyTo || editingMessage) && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border animate-fade-in max-w-full overflow-hidden">
            <div
              className={`w-1 h-8 rounded-full ${editingMessage ? "bg-amber-500" : "bg-primary"}`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary flex items-center gap-1 truncate">
                {editingMessage ? (
                  <>
                    <Pencil className="h-3 w-3 shrink-0" /> Editing
                  </>
                ) : (
                  <>
                    <Reply className="h-3 w-3 shrink-0" /> {replyTo?.senderName}
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-10 overflow-hidden">
                {editingMessage?.content || replyTo?.content}
              </p>
            </div>
            <button
              aria-label={
                editingMessage ? "Cancel message edit" : "Cancel reply"
              }
              onClick={() => {
                setReplyTo(null);
                if (editingMessage) setMessageText(draftBeforeEdit.current);
                setEditingMessage(null);
              }}
              className="shrink-0 h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 p-2 max-w-screen-xl mx-auto">
          <button
            onClick={handleOpenAttachments}
            aria-label="Add attachment"
            disabled={isSending || editMessage.isPending}
            className="shrink-0 h-11 w-11 rounded-full hover:bg-muted/60 flex items-center justify-center transition-colors active:scale-95"
          >
            <Plus className="h-6 w-6 text-muted-foreground" />
          </button>

          <textarea
            ref={textareaRef}
            aria-label="Write a message"
            disabled={isSending || editMessage.isPending}
            value={messageText}
            onChange={handleTextChange}
            onKeyDown={handleKeyPress}
            onBlur={stopTyping}
            placeholder="Message..."
            className="flex-1 resize-none min-h-[44px] max-h-[120px] text-[16px] rounded-2xl bg-muted/50 border-0 px-4 py-2.5 outline-none focus:bg-muted/80 transition-colors placeholder:text-muted-foreground"
            rows={1}
            dir="auto"
          />

          {hasText ? (
            <button
              aria-label={editingMessage ? "Save message edit" : "Send message"}
              onClick={() => void handleSendMessage()}
              disabled={isSending || editMessage.isPending}
              className="msg-send shrink-0 h-11 w-11 flex items-center justify-center active:scale-90 transition-all disabled:opacity-50 shadow-sm"
            >
              {isSending || editMessage.isPending ? (
                <SerkleLoader size="xs" className="text-primary-foreground" />
              ) : editingMessage ? (
                <Pencil className="h-5 w-5 text-primary-foreground" />
              ) : (
                <Send className="h-5 w-5 text-primary-foreground" />
              )}
            </button>
          ) : (
            <VoiceRecorder
              conversationId={conversation.conversation_id}
              onSend={handleSendAttachment}
            />
          )}
        </div>
      </div>

      {/* Action Menu */}
      <MessageActionMenu
        isOpen={actionMenu.isOpen}
        isOwn={actionMenu.message?.senderId === currentUserId}
        position={actionMenu.position}
        onClose={() => window.history.back()}
        onReply={handleReply}
        onForward={handleForward}
        onCopy={handleCopy}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPin={handlePin}
        onReact={handleReact}
      />

      {/* Reaction Bar */}
      <ReactionBar
        isOpen={reactionBar.isOpen}
        position={reactionBar.position}
        pending={toggleReaction.isPending}
        onSelect={async (emoji) => {
          if (toggleReaction.isPending) return;
          try {
            await toggleReaction.mutateAsync({
              messageId: reactionBar.messageId,
              userId: currentUserId,
              emoji,
            });
            window.history.back();
          } catch {
            toast.error("Reaction could not be saved. Please try again.");
          }
        }}
        onClose={() => window.history.back()}
      />

      {/* Delete Dialog */}
      <DeleteMessageDialog
        isOpen={deleteDialog.isOpen}
        isOwn={deleteDialog.message?.senderId === currentUserId}
        onClose={() => window.history.back()}
        onDeleteForMe={() => {
          if (deleteDialog.message) {
            return deleteForMe.mutateAsync({
              messageId: deleteDialog.message.id,
              userId: currentUserId,
              conversationId: conversation.conversation_id,
            });
          }
        }}
        onDeleteForEveryone={() => {
          if (deleteDialog.message) {
            return deleteForEveryone.mutateAsync({
              messageId: deleteDialog.message.id,
              conversationId: conversation.conversation_id,
            });
          }
        }}
      />

      {/* Forward Modal */}
      <ForwardMessageModal
        isOpen={forwardModal.isOpen}
        onClose={() => window.history.back()}
        conversations={(conversations || []).filter(
          (c) => c.conversation_id !== conversation.conversation_id,
        )}
        onForward={(convIds, messageIds) => {
          if (forwardModal.message) {
            return forwardMessage.mutateAsync({
              content: forwardModal.message.content,
              messageType: forwardModal.message.messageType,
              attachmentUrl: forwardModal.message.attachmentUrl,
              senderName: forwardModal.message.senderName,
              targetConversationIds: convIds,
              senderId: currentUserId,
              messageIds,
            });
          }
        }}
      />

      {/* Attachment Sheet */}
      <TelegramAttachmentSheet
        open={attachmentSheetOpen}
        onClose={() => {
          setAttachmentSheetOpen(false);
          window.history.back();
        }}
        conversationId={conversation.conversation_id}
        senderId={currentUserId}
        onSendAttachment={handleSendAttachment}
        onMediaSelected={handleMediaSelected}
      />

      {/* Media Preview */}
      {mediaPreview && (
        <MediaPreviewModal
          files={mediaPreview.files}
          mediaType={mediaPreview.type}
          onClose={() => setMediaPreview(null)}
          onSend={handleSendAttachment}
          conversationId={conversation.conversation_id}
          initialCaption={messageText}
          onCaptionConsumed={() => {
            setMessageText("");
            setReplyTo(null);
          }}
        />
      )}

      {/* Media Lightbox */}
      {lightbox && (
        <MediaLightbox
          items={lightbox.items}
          initialIndex={lightbox.index}
          onClose={() => window.history.back()}
        />
      )}

      {/* Circle Invitation Modal */}
      <CircleInvitationModal
        invitationId={invitationModalId}
        open={!!invitationModalId}
        onOpenChange={(open) => {
          if (!open) window.history.back();
        }}
      />

      {/* Group Info Modal */}
      {conversation.is_group && (
        <GroupInfoModal
          isOpen={desktop ? !profileDismissed : groupInfoOpen}
          presentation={desktop ? "panel" : "dialog"}
          onClose={() =>
            desktop ? setProfileDismissed(true) : window.history.back()
          }
          onLeft={() => {
            if (!desktop) window.history.back();
            setTimeout(() => navigate("/messages", { replace: true }), 100);
          }}
          conversationId={conversation.conversation_id}
          groupName={conversation.group_name || "Group"}
          groupAvatarUrl={conversation.group_avatar_url}
          currentUserId={currentUserId}
          onViewMessage={(id) => void scrollToMessage(id)}
          onMediaSelect={(url, type) =>
            handleOpenLightbox([{ id: url, url, type }], 0)
          }
        />
      )}

      {/* Media Gallery Modal */}
      <ChatMediaGalleryModal
        isOpen={
          !conversation.is_group &&
          (desktop ? !profileDismissed : mediaGalleryOpen)
        }
        presentation={desktop ? "panel" : "dialog"}
        onClose={() =>
          desktop ? setProfileDismissed(true) : window.history.back()
        }
        messages={messages}
        profileName={
          conversation.is_group
            ? conversation.group_name || "Group"
            : conversation.other_user_name || "User"
        }
        profileAvatar={
          conversation.is_group
            ? conversation.group_avatar_url
            : conversation.other_user_avatar
        }
        profileInitials={conversation.other_user_initials}
        isGroup={!!conversation.is_group}
        memberCount={conversation.member_count}
        otherUserId={conversation.other_user_id}
        otherUserUsername={conversation.other_user_username}
        onViewProfile={handleNavigateToProfile}
        onSearch={handleOpenSearch}
        onViewMessage={(id) => void scrollToMessage(id)}
        currentUserId={currentUserId}
        conversationId={conversation.conversation_id}
        onMediaSelect={(url, type) => {
          const singleMediaItem: MediaItem = { id: url, url, type };
          handleOpenLightbox([singleMediaItem], 0);
        }}
      />
    </div>
  );
};

export default ChatView;
