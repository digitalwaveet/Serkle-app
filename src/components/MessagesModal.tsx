import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, Phone, Video, MoreVertical, ArrowLeft, Smile, Paperclip, Camera } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  isOwn: boolean;
  isRead?: boolean;
}

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  isOnline: boolean;
  isTyping?: boolean;
  messages: Message[];
}

const mockConversations: Conversation[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b9d3f0b4?w=150&h=150&fit=crop&crop=face',
    lastMessage: 'Thanks for the breakfast ideas! My toddler actually ate everything 😊',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    unreadCount: 2,
    isOnline: true,
    messages: [
      {
        id: '1',
        text: 'Hi! I saw your post about toddler breakfast ideas',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        isOwn: false,
      },
      {
        id: '2',
        text: 'Hi Sarah! Yes, those recipes have been a lifesaver with my little one',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000),
        isOwn: true,
      },
      {
        id: '3',
        text: 'Could you share the banana pancake recipe? It looks amazing!',
        timestamp: new Date(Date.now() - 90 * 60 * 1000),
        isOwn: false,
      },
      {
        id: '4',
        text: 'Of course! Here it is:\n\n2 bananas, mashed\n2 eggs\n1/4 cup oats\nPinch of cinnamon\n\nMix and cook like regular pancakes! My daughter loves them',
        timestamp: new Date(Date.now() - 85 * 60 * 1000),
        isOwn: true,
      },
      {
        id: '5',
        text: 'Thanks for the breakfast ideas! My toddler actually ate everything 😊',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        isOwn: false,
        isRead: false,
      },
    ],
  },
  {
    id: '2',
    name: 'Mom Support Group',
    avatar: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=150&h=150&fit=crop&crop=face',
    lastMessage: 'Maria: Does anyone have tips for sleep regression?',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    unreadCount: 0,
    isOnline: false,
    messages: [
      {
        id: '1',
        text: 'Hi everyone! Hope you\'re all having a good week',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
        isOwn: true,
      },
      {
        id: '2',
        text: 'Maria: Does anyone have tips for sleep regression?',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        isOwn: false,
      },
    ],
  },
  {
    id: '3',
    name: 'Dr. Emily Parker',
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face',
    lastMessage: 'Your appointment is confirmed for tomorrow at 2 PM',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    unreadCount: 0,
    isOnline: false,
    messages: [
      {
        id: '1',
        text: 'Your appointment is confirmed for tomorrow at 2 PM',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
        isOwn: false,
      },
    ],
  },
  {
    id: '4',
    name: 'Lisa Chen',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    lastMessage: 'Would love to connect! Fellow mom of twins here 👯‍♀️',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    unreadCount: 0,
    isOnline: true,
    isTyping: false,
    messages: [
      {
        id: '1',
        text: 'Hi! I saw your post about twin sleep schedules',
        timestamp: new Date(Date.now() - 7 * 60 * 60 * 1000),
        isOwn: false,
      },
      {
        id: '2',
        text: 'Hi Lisa! Yes, it\'s been quite the journey figuring that out',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000 + 30 * 60 * 1000),
        isOwn: true,
      },
      {
        id: '3',
        text: 'Would love to connect! Fellow mom of twins here 👯‍♀️',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
        isOwn: false,
      },
    ],
  },
];

export const MessagesModal: React.FC<MessagesModalProps> = ({ isOpen, onClose }) => {
  const [conversations, setConversations] = useState(mockConversations);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetchingConversations, setIsFetchingConversations] = useState(true);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);

  React.useEffect(() => {
    // Simulate initial conversations fetch
    const timer = setTimeout(() => {
      setIsFetchingConversations(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const totalUnreadCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      text: newMessage,
      timestamp: new Date(),
      isOwn: true,
    };

    setConversations(prev =>
      prev.map(conv =>
        conv.id === selectedConversation
          ? {
              ...conv,
              messages: [...conv.messages, newMsg],
              lastMessage: newMessage,
              timestamp: new Date(),
            }
          : conv
      )
    );

    setNewMessage('');

    // Simulate response after 2 seconds
    setTimeout(() => {
      const responses = [
        "That sounds great!",
        "Thanks for sharing 😊",
        "I'll try that!",
        "Absolutely agree",
        "That's so helpful, thank you!",
      ];
      
      const responseMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
        isOwn: false,
      };

      setConversations(prev =>
        prev.map(conv =>
          conv.id === selectedConversation
            ? {
                ...conv,
                messages: [...conv.messages, responseMsg],
                lastMessage: responseMsg.text,
                timestamp: new Date(),
                unreadCount: conv.unreadCount + 1,
              }
            : conv
        )
      );
    }, 2000);
  };

  const markConversationAsRead = (convId: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === convId
          ? { ...conv, unreadCount: 0 }
          : conv
      )
    );
  };

  if (selectedConversation && selectedConv) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md h-[80vh] flex flex-col p-0">
          {/* Chat Header */}
          <DialogHeader className="p-4 border-b bg-card">
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedConversation(null)}
                className="p-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedConv.avatar} />
                <AvatarFallback>{selectedConv.name[0]}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{selectedConv.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedConv.isOnline ? 'Online' : `Active ${formatDistanceToNow(selectedConv.timestamp, { addSuffix: true })}`}
                </p>
              </div>
              
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="p-2">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="p-2">
                  <Video className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="p-2">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {isFetchingMessages ? (
              <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading messages" showText /></div>
            ) : (
              <div className="space-y-4">
                {selectedConv.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg p-3 ${
                        message.isOwn
                          ? 'bg-primary text-white'
                          : 'bg-muted/50 text-foreground'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-line">{message.text}</p>
                      <p className={`text-xs mt-1 ${
                        message.isOwn ? 'text-white/70' : 'text-muted-foreground'
                      }`}>
                        {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {selectedConv.isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t bg-card">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="p-2">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="p-2">
                <Camera className="h-4 w-4" />
              </Button>
              
              <div className="flex-1 relative">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="pr-10"
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
              
              <Button
                size="sm"
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="px-3"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Messages
              {totalUnreadCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {totalUnreadCount}
                </Badge>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-4">
            {isFetchingConversations ? (
              <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading messages" showText /></div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No conversations found</p>
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => {
                    if (selectedConversation === conversation.id) return;
                    setIsFetchingMessages(true);
                    setSelectedConversation(conversation.id);
                    markConversationAsRead(conversation.id);
                    
                    // Simulate message fetching
                    setTimeout(() => {
                      setIsFetchingMessages(false);
                    }, 600);
                  }}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={conversation.avatar} />
                      <AvatarFallback>{conversation.name[0]}</AvatarFallback>
                    </Avatar>
                    {conversation.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm truncate">
                        {conversation.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(conversation.timestamp, { addSuffix: true })}
                        </span>
                        {conversation.unreadCount > 0 && (
                          <Badge variant="secondary" className="text-xs min-w-[18px] h-5">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {conversation.lastMessage}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};