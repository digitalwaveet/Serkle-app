import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UserProfile from '@/components/UserProfile';
import SettingsModal from '@/components/SettingsModal';
import { useUser } from '@/contexts/UserContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);

  if (!isOpen) return null;

  const handleMessageClick = () => {
    onClose();
    navigate('/messages');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm animate-fade-in safe-area-full">
      <div className="h-full w-full bg-background overflow-y-auto scroll-optimized scrollbar-thin overscroll-behavior-contain animate-scale-in">
        
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <h1 className="text-xl font-bold text-foreground">Profile</h1>
            
            <div className="w-10" />
          </div>
        </div>

        {/* Profile Content */}
        <UserProfile 
          showHeader={false}
          onMessageClick={handleMessageClick}
          onSettingsClick={() => setShowSettings(true)}
        />
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default ProfileModal;
