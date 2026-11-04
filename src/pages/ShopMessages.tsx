import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Image as ImageIcon, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useShopConversations, useShopMessages, useShopMessageMutations } from '@/hooks/useShopMessages';

import FooterNav from '@/components/FooterNav';
import { format } from 'date-fns';

const ShopMessages: React.FC = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { data: conversations, isLoading: conversationsLoading } = useShopConversations();
  const { data: messages, isLoading: messagesLoading } = useShopMessages(conversationId);
  const { sendMessage } = useShopMessageMutations();
  const [messageText, setMessageText] = useState('');

  const selectedConversation = conversations?.find(c => c.id === conversationId);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !conversationId) return;

    try {
      await sendMessage.mutateAsync({
        conversationId,
        message: messageText,
      });
      setMessageText('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (!conversationId) {
    // Conversations List
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
          <div className="flex items-center gap-3 p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/shop')}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">Shop Messages</h1>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {conversationsLoading ? (
            <div className="flex justify-center py-12">
              <SerkleLoader size="md" className="text-primary" />
            </div>
          ) : !conversations || conversations.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No conversations yet</p>
            </Card>
          ) : (
            conversations.map((conv) => (
              <Card
                key={conv.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/shop/messages/${conv.id}`)}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={conv.other_user_avatar} />
                    <AvatarFallback>{conv.other_user_name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm truncate">
                        {conv.other_user_name}
                      </p>
                      {conv.last_message_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(conv.last_message_at), 'MMM dd')}
                        </span>
                      )}
                    </div>
                    {conv.item_title && (
                      <p className="text-xs text-muted-foreground mb-1">
                        About: {conv.item_title}
                      </p>
                    )}
                    {conv.last_message && (
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <FooterNav active="shop" onSelect={() => {}} onOpenCreate={() => {}} />
      </div>
    );
  }

  // Chat View
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/shop/messages')}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {selectedConversation && (
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={selectedConversation.other_user_avatar} />
                  <AvatarFallback>{selectedConversation.other_user_name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{selectedConversation.other_user_name}</p>
                  {selectedConversation.item_title && (
                    <p className="text-xs text-muted-foreground">
                      {selectedConversation.item_title}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" className="p-2">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesLoading ? (
          <div className="flex justify-center py-12">
            <SerkleLoader size="md" className="text-primary" />
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  msg.is_from_me
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.is_from_me
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground'
                  }`}
                >
                  {format(new Date(msg.created_at), 'hh:mm a')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ImageIcon className="w-5 h-5" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={!messageText.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <SerkleLoader size="xs" className="text-current" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShopMessages;
