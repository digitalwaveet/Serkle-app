import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useConversations, useCreateConversation } from '@/hooks/useConversations';
import ConversationsList from '@/components/messages/ConversationsList';
import ChatView from '@/components/messages/ChatView';
import CreateGroupModal from '@/components/messages/CreateGroupModal';
import { useNavigation } from '@/contexts/NavigationContext';

const Messages = () => {
  const navigate = useNavigate();
  const { conversationId: selectedConversationId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { pushModalState } = useNavigation();
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const handleOpenCreateGroup = () => {
    pushModalState('create-group', () => setShowCreateGroup(false));
    setShowCreateGroup(true);
  };
  
  const { conversations, isLoading } = useConversations(user?.id);
  const { createConversation } = useCreateConversation();

  // Handle opening group creation modal from URL params
  useEffect(() => {
    if (searchParams.get('createGroup') === 'true') {
      setShowCreateGroup(true);
      navigate('/messages', { replace: true });
    }
  }, [searchParams, navigate]);

  // Handle opening conversation from URL params (when clicking "Message" on profile)
  useEffect(() => {
    const userId = searchParams.get('userId');
    if (userId && user?.id && !selectedConversationId) {
      const initConversation = async () => {
        try {
          const conversationId = await createConversation(user.id, userId);
          navigate(`/messages/${conversationId}`, { replace: true });
        } catch (error) {
          console.error('Error creating conversation:', error);
        }
      };
      initConversation();
    }
  }, [searchParams, user?.id, createConversation, selectedConversationId, navigate]);

  const selectedConversation = conversations.find(
    (c) => c.conversation_id === selectedConversationId
  );

  const handleBack = () => {
    const hasHistory = window.history.state && window.history.state.idx > 0;
    if (hasHistory) {
      navigate(-1);
    } else {
      navigate('/messages', { replace: true });
    }
  };

  const handleSelectConversation = (id: string) => {
    navigate(`/messages/${id}`);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Only show when no conversation selected on mobile */}
      {!selectedConversationId && (
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b border-border/50 safe-top lg:hidden">
          <div className="flex items-center justify-between px-3 py-3">
            <button
              onClick={() => {
                const hasHistory = window.history.state && window.history.state.idx > 0;
                if (hasHistory) {
                  navigate(-1);
                } else {
                  navigate('/', { replace: true });
                }
              }}
              className="p-2 -ml-2 hover:bg-muted rounded-full active:scale-95 transition-all"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-bold">Messages</h1>
            <button
              onClick={handleOpenCreateGroup}
              className="p-2 -mr-2 hover:bg-muted rounded-full active:scale-95 transition-all"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      {/* One responsive tree: never mount a second hidden chat/subscription. */}
      <div className="flex h-dvh">
        {/* Conversations List */}
        <div className={`${selectedConversation ? 'hidden lg:block' : 'block'} w-full lg:w-96 lg:shrink-0 lg:border-r border-border bg-background`}>
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-4 hidden lg:flex items-center justify-between">
            <h1 className="text-xl font-bold">Messages</h1>
            <button
              onClick={handleOpenCreateGroup}
              className="p-2 -mr-2 hover:bg-muted rounded-full active:scale-95 transition-all"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <ConversationsList
            conversations={conversations}
            selectedConversationId={selectedConversationId || null}
            onSelectConversation={handleSelectConversation}
            isLoading={isLoading}
            currentUserId={user.id}
          />
        </div>

        {/* Chat View */}
        <div className={`${selectedConversation ? 'block' : 'hidden lg:block'} min-w-0 flex-1`}>
          {selectedConversation ? (
            <ChatView
              key={selectedConversation.conversation_id}
              conversation={selectedConversation}
              currentUserId={user.id}
              currentUserAvatar={user.avatar}
              currentUserInitials={user.initials}
              currentUserName={user.name}
              onBack={handleBack}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-center p-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Select a conversation</h2>
                <p className="text-muted-foreground">
                  Choose a conversation from the list to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        currentUserId={user.id}
        onGroupCreated={handleSelectConversation}
      />
    </div>
  );
};

export default Messages;
