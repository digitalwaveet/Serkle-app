import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, RotateCcw, Sparkles, MapPin, Play, Users, Globe, X, UserPlus, Music, Zap } from 'lucide-react';
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

interface PreLiveSettingsProps {
  config: LiveConfig;
  onComplete: (config: Partial<LiveConfig>) => void;
  onBack: () => void;
}

const PreLiveSettings: React.FC<PreLiveSettingsProps> = ({ config, onComplete, onBack }) => {
  const [settings, setSettings] = useState<LiveConfig>(config);
  const [beautyMode, setBeautyMode] = useState(false);
  const [showMusicSelector, setShowMusicSelector] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleSettingChange = (key: keyof LiveConfig, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: settings.cameraFlipped ? 'environment' : 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (error) {
        console.error('Camera access error:', error);
        toast.error('Failed to access camera. Please check permissions.');
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handle camera flip
  useEffect(() => {
    const switchCamera = async () => {
      if (!streamRef.current) return;

      // Stop current stream
      streamRef.current.getTracks().forEach(track => track.stop());

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: settings.cameraFlipped ? 'environment' : 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (error) {
        console.error('Failed to switch camera:', error);
        toast.error('Failed to switch camera');
      }
    };

    if (cameraReady) {
      switchCamera();
    }
  }, [settings.cameraFlipped]);

  const handleStartLive = () => {
    if (!settings.title.trim()) {
      toast.error('Please add a title for your live stream');
      return;
    }
    if (!cameraReady) {
      toast.error('Camera is not ready yet');
      return;
    }
    onComplete(settings);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Full-screen Camera Preview */}
      <div className="relative w-full h-full bg-black">
        {/* Real camera video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: settings.cameraFlipped ? 'scaleX(1)' : 'scaleX(-1)'
          }}
        />
        
        {/* Camera loading state */}
        {!cameraReady && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-white text-center">
              <SerkleLoader size="md" className="text-white mx-auto mb-4" />
              <p className="text-lg">Initializing camera...</p>
            </div>
          </div>
        )}
        
        {/* Beauty/Filter effects overlay */}
        {beautyMode && (
          <div className="absolute inset-0 bg-pink-100/20 backdrop-blur-[0.5px]" />
        )}
        {settings.filters && (
          <div className="absolute inset-0 bg-purple-100/20 backdrop-saturate-150" />
        )}

        {/* Top Overlay Controls */}
        <div className="absolute top-0 left-0 right-0 z-10 p-3 bg-gradient-to-b from-black/40 to-transparent">
          <div className="flex items-center justify-between">
            {/* Left side - Back button */}
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>

            {/* Right side controls */}
            <div className="flex items-center gap-1">
              {/* Camera flip */}
              <button
                onClick={() => handleSettingChange('cameraFlipped', !settings.cameraFlipped)}
                className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center"
              >
                <RotateCcw className="w-3.5 h-3.5 text-white" />
              </button>

              {/* Beauty mode */}
              <button
                onClick={() => setBeautyMode(!beautyMode)}
                className={`w-8 h-8 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center ${
                  beautyMode ? 'bg-pink-500/60' : 'bg-black/20'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-white" />
              </button>

              {/* Filters */}
              <button
                onClick={() => handleSettingChange('filters', !settings.filters)}
                className={`w-8 h-8 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center ${
                  settings.filters ? 'bg-purple-500/60' : 'bg-black/20'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Overlay Panel */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pb-6">
          <div className="space-y-3">
            {/* Live type indicator */}
            <div className="flex items-center gap-1.5 text-white/70 text-xs">
              {config.type === 'circle' ? (
                <>
                  <Users className="w-3 h-3" />
                  <span>{config.circleName}</span>
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3" />
                  <span>Public Live</span>
                </>
              )}
            </div>

            {/* Title Input */}
            <input
              type="text"
              value={settings.title}
              onChange={(e) => handleSettingChange('title', e.target.value)}
              placeholder="What's your live about?"
              className="w-full px-3 py-2 bg-card/10 backdrop-blur-md border border-white/15 rounded-lg text-white text-sm placeholder-white/50 focus:ring-1 focus:ring-white/30 focus:border-transparent"
              maxLength={100}
            />

            {/* Quick Settings Row */}
            <div className="flex items-center justify-between gap-2">
              {/* Visibility */}
              <button
                onClick={() => handleSettingChange('visibility', 
                  settings.visibility === 'public' ? 'friends' : 
                  settings.visibility === 'friends' ? 'circle' : 'public'
                )}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-card/10 backdrop-blur-md rounded-md border border-white/15"
              >
                <Globe className="w-3 h-3 text-white" />
                <span className="text-white text-xs capitalize">{settings.visibility}</span>
              </button>

              {/* Location */}
              <button
                onClick={() => handleSettingChange('locationVisible', !settings.locationVisible)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border backdrop-blur-md ${
                  settings.locationVisible 
                    ? 'bg-blue-500/30 border-blue-400/30' 
                    : 'bg-card/10 border-white/15'
                }`}
              >
                <MapPin className="w-3 h-3 text-white" />
                <span className="text-white text-xs">Location</span>
              </button>

              {/* Co-host */}
              <button className="flex items-center gap-1.5 px-2 py-1.5 bg-card/10 backdrop-blur-md rounded-md border border-white/15">
                <UserPlus className="w-3 h-3 text-white" />
                <span className="text-white text-xs">Co-host</span>
              </button>

              {/* Music */}
              <button
                onClick={() => setShowMusicSelector(!showMusicSelector)}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-card/10 backdrop-blur-md rounded-md border border-white/15"
              >
                <Music className="w-3 h-3 text-white" />
                <span className="text-white text-xs">Music</span>
              </button>
            </div>

            {/* Music Selector */}
            {showMusicSelector && (
              <div className="bg-card/10 backdrop-blur-md rounded-lg p-2 border border-white/15">
                <div className="text-white text-xs mb-1.5 font-medium">Background Music</div>
                <div className="grid grid-cols-2 gap-1">
                  {['No Music', 'Upbeat', 'Chill', 'Pop'].map((music) => (
                    <button
                      key={music}
                      className="text-left px-2 py-1 text-white/80 hover:bg-card/10 rounded text-xs"
                    >
                      {music}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={onBack}
                className="flex-1 py-2 px-3 bg-card/10 backdrop-blur-md border border-white/15 rounded-lg text-white text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleStartLive}
                disabled={!settings.title.trim()}
                className="flex-2 py-2 px-4 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                Go Live
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreLiveSettings;