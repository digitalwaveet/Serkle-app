import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Camera, CameraOff, RotateCcw, Sparkles, MapPin, Users, Eye, MoreVertical, PhoneOff, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLiveMutations } from '@/hooks/useLiveMutations';
import { useWebRTCLive } from '@/hooks/useWebRTCLive';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface LiveConfig {
  type: 'random' | 'circle';
  circleId?: string;
  circleName?: string;
  title: string;
  description: string;
  filters: boolean;
  cameraFlipped: boolean;
  micEnabled: boolean;
  locationVisible: boolean;
  visibility: 'public' | 'friends' | 'circle';
}

interface WebRTCLiveSimulationProps {
  config: LiveConfig;
  onEndLive: () => void;
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

const WebRTCLiveSimulation: React.FC<WebRTCLiveSimulationProps> = ({ config, onEndLive }) => {
  const [streamId, setStreamId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { startLive, endLive, sendMessage } = useLiveMutations();
  
  // Initialize WebRTC for real video streaming
  const {
    localStream,
    isConnected,
    isMicMuted,
    isCameraOff,
    toggleMic,
    toggleCamera,
    switchCamera,
  } = useWebRTCLive({
    streamId,
    role: 'host',
  });

  // Fetch stream data
  const { data: stream } = useQuery({
    queryKey: ['live-stream', streamId],
    queryFn: async () => {
      if (!streamId) return null;
      const { data } = await (supabase as any)
        .from('live_streams')
        .select('*')
        .eq('id', streamId)
        .maybeSingle();
      return data;
    },
    enabled: !!streamId,
    refetchInterval: 5000
  });

  // Start live stream on mount
  useEffect(() => {
    const initLive = async () => {
      try {
        const stream = await startLive({
          type: config.type,
          circleId: config.circleId,
          title: config.title,
          description: config.description,
          visibility: config.visibility,
          locationVisible: config.locationVisible
        });
        setStreamId(stream.id);
      } catch (error) {
        console.error('Failed to start live:', error);
        toast.error('Failed to start live stream');
        onEndLive();
      }
    };

    initLive();
  }, []);

  // Play local video
  useEffect(() => {
    if (localStream && videoRef.current) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Duration counter
  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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

  // Real-time viewer updates
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`live-viewers-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_viewers',
          filter: `stream_id=eq.${streamId}`
        },
        () => {
          // Viewer joined or left
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !streamId) return;
    
    try {
      await sendMessage(streamId, messageText);
      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndLive = () => {
    setShowEndConfirm(true);
  };

  const confirmEndLive = async () => {
    if (streamId) {
      try {
        await endLive(streamId);
      } catch (error) {
        console.error('Failed to end live:', error);
      }
    }
    onEndLive();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black overflow-hidden">
      {/* Real Video Stream */}
      <video 
        ref={videoRef} 
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ 
          transform: config.cameraFlipped ? 'scaleX(-1)' : 'none',
        }}
      />
      
      {/* Loading overlay while connecting */}
      {!isConnected && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="text-white text-center">
            <SerkleLoader size="md" className="text-white mx-auto mb-4" />
            <p className="text-lg">Starting live stream...</p>
            <p className="text-sm text-white/60 mt-2">Using WebRTC (no API key required)</p>
          </div>
        </div>
      )}
      
      {/* Live Indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
          <div className="w-2 h-2 bg-card rounded-full animate-pulse" />
          LIVE
        </div>
        <div className="bg-black/50 text-white px-2 py-1 rounded text-sm backdrop-blur-sm">
          {formatDuration(duration)}
        </div>
      </div>

      {/* Live Stats */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className="bg-black/50 text-white px-2 py-1 rounded text-sm backdrop-blur-sm flex items-center gap-1">
          <Eye className="w-3 h-3" />
          {(stream as any)?.viewer_count || 0}
        </div>
      </div>

      {/* Title Overlay */}
      <div className="absolute bottom-20 left-4 right-4">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white">
          <h3 className="font-semibold text-lg">{config.title}</h3>
          {config.description && (
            <p className="text-sm opacity-90 mt-1">{config.description}</p>
          )}
          {config.type === 'circle' && (
            <div className="flex items-center gap-1 mt-2 text-xs opacity-80">
              <Users className="w-3 h-3" />
              <span>Broadcasting to {config.circleName}</span>
            </div>
          )}
          {config.locationVisible && (
            <div className="flex items-center gap-1 mt-1 text-xs opacity-80">
              <MapPin className="w-3 h-3" />
              <span>New York, NY</span>
            </div>
          )}
        </div>
      </div>

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

      {/* Control Bar */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-black/50 backdrop-blur-sm rounded-full p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mic Control */}
            <button
              onClick={toggleMic}
              className={`p-2 rounded-full transition-colors ${
                isMicMuted ? 'bg-red-500' : 'bg-card/20'
              }`}
            >
              {isMicMuted ? (
                <MicOff className="w-5 h-5 text-white" />
              ) : (
                <Mic className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Camera Control */}
            <button
              onClick={toggleCamera}
              className={`p-2 rounded-full transition-colors ${
                isCameraOff ? 'bg-red-500' : 'bg-card/20'
              }`}
            >
              {isCameraOff ? (
                <CameraOff className="w-5 h-5 text-white" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Camera Flip */}
            <button 
              onClick={switchCamera}
              className="p-2 rounded-full bg-card/20"
            >
              <RotateCcw className="w-5 h-5 text-white" />
            </button>

            {/* Filters */}
            {config.filters && (
              <button className="p-2 rounded-full bg-purple-500">
                <Sparkles className="w-5 h-5 text-white" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* More Options */}
            <button className="p-2 rounded-full bg-card/20">
              <MoreVertical className="w-5 h-5 text-white" />
            </button>

            {/* End Live */}
            <button
              onClick={handleEndLive}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-full text-white font-medium transition-colors flex items-center gap-1"
            >
              <PhoneOff className="w-4 h-4" />
              End
            </button>
          </div>
        </div>
      </div>

      {/* End Live Confirmation */}
      {showEndConfirm && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card rounded-xl p-6 mx-4 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">End Live Stream?</h3>
            <p className="text-muted-foreground text-sm mb-6">
              You've been live for {formatDuration(duration)} with {(stream as any)?.viewer_count || 0} viewers.
              Are you sure you want to end your live stream?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEndLive}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                End Live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebRTCLiveSimulation;
