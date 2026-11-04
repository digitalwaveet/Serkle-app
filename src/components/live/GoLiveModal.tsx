import React, { useState } from 'react';
import { X, Users, Globe, Settings, ArrowLeft } from 'lucide-react';
import LiveTypeSelection from './LiveTypeSelection';
import PreLiveSettings from './PreLiveSettings';
import WebRTCLiveSimulation from './WebRTCLiveSimulation';

interface GoLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LiveStep = 'selection' | 'settings' | 'live';
type LiveType = 'random' | 'circle';

interface LiveConfig {
  type: LiveType;
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

const GoLiveModal: React.FC<GoLiveModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState<LiveStep>('selection');
  const [liveConfig, setLiveConfig] = useState<LiveConfig>({
    type: 'random',
    title: '',
    description: '',
    filters: false,
    cameraFlipped: false,
    micEnabled: true,
    locationVisible: false,
    visibility: 'public'
  });

  if (!isOpen) return null;

  const handleTypeSelect = (type: LiveType, circleId?: string, circleName?: string) => {
    setLiveConfig(prev => ({ 
      ...prev, 
      type, 
      circleId, 
      circleName,
      visibility: type === 'circle' ? 'circle' : 'public'
    }));
    setCurrentStep('settings');
  };

  const handleSettingsComplete = (config: Partial<LiveConfig>) => {
    console.log('Settings complete, transitioning to live with config:', config);
    setLiveConfig(prev => ({ ...prev, ...config }));
    setCurrentStep('live');
    console.log('Current step set to: live');
  };

  const handleBack = () => {
    if (currentStep === 'settings') {
      setCurrentStep('selection');
    } else if (currentStep === 'live') {
      setCurrentStep('settings');
    }
  };

  const handleEndLive = () => {
    setCurrentStep('selection');
    setLiveConfig({
      type: 'random',
      title: '',
      description: '',
      filters: false,
      cameraFlipped: false,
      micEnabled: true,
      locationVisible: false,
      visibility: 'public'
    });
    onClose();
  };

  const getTitle = () => {
    switch (currentStep) {
      case 'selection': return 'Go Live';
      case 'settings': return 'Live Settings';
      case 'live': return 'Live Now';
      default: return 'Go Live';
    }
  };

  const showBackButton = currentStep !== 'selection';

  // Full-screen views for settings and live
  if (currentStep === 'settings') {
    return (
      <PreLiveSettings
        config={liveConfig}
        onComplete={handleSettingsComplete}
        onBack={handleBack}
      />
    );
  }

  if (currentStep === 'live') {
    return (
      <WebRTCLiveSimulation 
        config={liveConfig} 
        onEndLive={handleEndLive} 
      />
    );
  }

  // Modal view for type selection
  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label="Go Live"
      className="fixed inset-0 z-50 animate-fade-in"
    >
      <div className="absolute inset-0 w-full h-full backdrop-blur-xl bg-black/50" />
      
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-primary">{getTitle()}</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted/50 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
            <LiveTypeSelection onTypeSelect={handleTypeSelect} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoLiveModal;