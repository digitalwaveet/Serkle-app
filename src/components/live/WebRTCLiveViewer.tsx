import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useRef } from 'react';
import { Eye, Send, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWebRTCLive } from '@/hooks/useWebRTCLive';
import { useLiveMutations } from '@/hooks/useLiveMutations';
import { useQuery } from '@tanstack/react-query';

interface WebRTCLiveViewerProps {
  streamId: string;
  onClose: () => void;
}

interface LiveMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles: {
    username: string;
    name: string;
  };
}

const WebRTCLiveViewer: React.FC<WebRTCLiveViewerProps> = ({ streamId, onClose }) => {
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { sendMessage, joinStream, leaveStream } = useLiveMutations();
  
  const {
    remoteStreams,
    isConnected,
  } = useWebRTCLive({
    streamId,
    role: 'audience',
  });

  // Fetch stream data
  const { data: stream } = useQuery({
    queryKey: ['live-stream', streamId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('live_streams')
        .select('*, profiles(username, name, avatar_url)')
        .eq('id', streamId)
        .maybeSingle();
      return data;
    },
    enabled: !!streamId,
    refetchInterval: 5000
  });

  // Play remote video
  useEffect(() => {
    const firstStream = Array.from(remoteStreams.values())[0];
    if (firstStream && videoRef.current) {
      videoRef.current.srcObject = firstStream;
      const play = videoRef.current.play();
      if (play && typeof play.then === 'function') {
        play.catch((err) => console.log('Autoplay prevented, waiting for user interaction', err));
      }
    }
  }, [remoteStreams]);

  // Real-time messages subscription
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`live-messages-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_messages',
          filter: `stream_id=eq.${streamId}`
        },
        async (payload) => {
          const { data: profile } = await (supabase as any)
            .from('profiles')
            .select('username, name')
            .eq('id', (payload.new as any).user_id)
            .maybeSingle();

          const newMessage: LiveMessage = {
            ...payload.new as any,
            profiles: profile || { username: 'User', name: 'User' }
          };
          
          setMessages(prev => [...prev, newMessage].slice(-20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    try {
      await sendMessage(streamId, messageText);
      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Join/leave live viewers list for accurate counts
  useEffect(() => {
    if (!streamId) return;
    joinStream(streamId).catch(console.error);
    return () => {
      leaveStream(streamId).catch(console.error);
    };
  }, [streamId]);

  return (
    <div className="fixed inset-0 z-[100] bg-black overflow-hidden">
      {/* Remote Video Stream */}
      <video 
        ref={videoRef} 
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Loading overlay while connecting */}
      {!isConnected && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="text-white text-center">
            <SerkleLoader size="md" className="text-white mx-auto mb-4" />
            <p className="text-lg">Connecting to live stream...</p>
            <p className="text-sm text-white/60 mt-2">WebRTC P2P connection</p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {stream?.profiles?.avatar_url ? (
              <img 
                src={stream.profiles.avatar_url} 
                alt={stream.profiles.name}
                className="w-10 h-10 rounded-full border-2 border-white"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium border-2 border-white">
                {stream?.profiles?.name?.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-white font-medium">{stream?.profiles?.name}</p>
              <div className="flex items-center gap-2 text-xs text-white/80">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  LIVE
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {stream?.viewer_count || 0}
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-card/20 backdrop-blur-sm hover:bg-card/30 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Stream Info */}
      {stream?.title && (
        <div className="absolute bottom-20 left-4 right-4">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white">
            <h3 className="font-semibold">{stream.title}</h3>
            {stream.description && (
              <p className="text-sm opacity-90 mt-1">{stream.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Comments Stream */}
      <div className="absolute bottom-32 left-4 right-20 max-h-40 overflow-hidden">
        <div className="space-y-1">
          {messages.slice(-5).map((msg) => (
            <div key={msg.id} className="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1 text-white text-sm animate-fade-in">
              <span className="font-medium text-blue-300">{msg.profiles.username}</span>
              <span className="ml-1">{msg.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Message Input */}
      <div className="absolute bottom-16 left-4 right-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Say something..."
            className="flex-1 bg-black/40 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white text-sm placeholder-white/50 focus:outline-none focus:border-white/40"
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-full p-2 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WebRTCLiveViewer;
