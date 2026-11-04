import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Send, Users } from 'lucide-react';
import { useSOSMessages } from '@/hooks/useSOSMessages';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/use-mobile';

interface SOSMessagingProps {
  alertId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SOSMessaging: React.FC<SOSMessagingProps> = ({ alertId, isOpen, onClose }) => {
  const [messageText, setMessageText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isMobile = useIsMobile();
  const { messages, isLoading, sendMessage } = useSOSMessages(alertId);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // Fetch alert details for requester info
  const { data: alertData } = useQuery({
    queryKey: ['alert-details', alertId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sos_alerts')
        .select('user_id, profiles!user_id(name)')
        .eq('id', alertId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch all helpers responding to this alert
  const { data: helpers } = useQuery({
    queryKey: ['alert-helpers', alertId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sos_helpers')
        .select('helper_user_id, profiles!helper_user_id(name, avatar_url, initials, avatar_color)')
        .eq('alert_id', alertId)
        .in('status', ['responding', 'arrived']);
      if (error) throw error;
      return data || [];
    },
  });

  // Typing indicator using Supabase Presence
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel(`typing-${alertId}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typingUsers = Object.values(state).flat();
        const othersTyping = typingUsers.some((u: any) => u.user_id !== currentUserId && u.typing);
        setIsTyping(othersTyping);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alertId, currentUserId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleTyping = () => {
    if (!currentUserId) return;

    const channel = supabase.channel(`typing-${alertId}`);
    channel.track({ user_id: currentUserId, typing: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      channel.track({ user_id: currentUserId, typing: false });
    }, 2000);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    await sendMessage.mutateAsync({
      alertId,
      messageText: messageText.trim(),
    });

    setMessageText('');
    
    // Stop typing indicator
    const channel = supabase.channel(`typing-${alertId}`);
    channel.track({ user_id: currentUserId, typing: false });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-left">
            <div className="flex items-center justify-between">
              <span>SOS Messages</span>
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {(helpers?.length || 0) + 1}
              </Badge>
            </div>
          </DrawerTitle>
        </DrawerHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[calc(85vh-180px)]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground">No messages yet</div>
            </div>
          ) : (
            messages.map((message: any) => {
              const isSystemMessage = message.is_system_message;
              const profile = message.profiles;

              if (isSystemMessage) {
                return (
                  <div key={message.id} className="flex justify-center">
                    <div className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
                      {message.message_text}
                    </div>
                  </div>
                );
              }

              const isRequester = message.sender_id === alertData?.user_id;
              const isCurrentUser = message.sender_id === currentUserId;
              
              return (
                <div key={message.id} className={`flex gap-2 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback 
                      style={{ 
                        backgroundColor: profile?.avatar_color || '#3b82f6' 
                      }}
                      className="text-white text-xs"
                    >
                      {profile?.initials || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 max-w-[75%]">
                    <div className={`flex items-center gap-1.5 mb-1 flex-wrap ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-medium">
                        {isCurrentUser ? 'You' : (profile?.name || 'User')}
                      </span>
                      {isRequester && (
                        <Badge className="bg-destructive/10 text-destructive text-[10px] h-4 px-1.5">Requester</Badge>
                      )}
                      {!isRequester && (
                        <Badge className="bg-success/10 text-success text-[10px] h-4 px-1.5">Helper</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(message.created_at), { 
                          addSuffix: true 
                        })}
                      </span>
                    </div>
                    <div className={`text-sm px-3 py-2 rounded-lg break-words ${
                      isCurrentUser 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                        : 'bg-muted text-foreground rounded-tl-sm'
                    }`}>
                      {message.message_text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {isTyping && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
              <div className="flex gap-1">
                <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs">Someone is typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                handleTyping();
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={sendMessage.isPending}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sendMessage.isPending}
              size="icon"
              className="shrink-0 touch-target"
            >
              {sendMessage.isPending ? (
                <SerkleLoader size="xs" className="text-primary-foreground" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
