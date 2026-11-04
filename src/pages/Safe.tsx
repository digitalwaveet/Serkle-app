import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import FooterNav from '../components/FooterNav';
import { InstallPrompt } from '../components/InstallPrompt';
import { SOSEmergencyView } from '../components/safe/SOSEmergencyView';
import { SOSProfile } from '../components/safe/SOSProfile';
import { EmergencyContactsModal } from '../components/safe/EmergencyContactsModal';
import { NotificationPreferencesModal } from '../components/safe/NotificationPreferencesModal';
import { ErrorBoundary } from '../components/safe/ErrorBoundary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, Bell } from 'lucide-react';
import { type TabKey } from '@/hooks/useAppNav';

// Lazy load the nearby view for better initial load performance
const SOSNearbyView = lazy(() =>
  import('../components/safe/SOSNearbyView').then(module => ({ default: module.SOSNearbyView }))
);
interface SafeProps {
  activeTab: TabKey;
  onTabSelect: (tab: TabKey) => void;
  onOpenCreate: () => void;
}
const Safe: React.FC<SafeProps> = ({
  activeTab,
  onTabSelect,
  onOpenCreate
}) => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'sos' | 'nearby' | 'profile'>('sos');
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showNotificationPrefs, setShowNotificationPrefs] = useState(false);

  return <div className="min-h-[100dvh] mx-auto bg-background text-foreground selection:bg-secondary/40 max-w-[480px] relative border-l border-r border-border font-sans" data-testid="safe-page">
    <InstallPrompt />
    <Header onNotifications={() => navigate('/notifications')} onMessages={() => navigate('/messages')} />

    <main className="pb-24 mobile-px">
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100 p-3 sm:p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => setShowContactsModal(true)}
            variant="outline"
            size="sm"
            className="w-full min-h-[44px] text-xs sm:text-sm"
          >
            <Users className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="truncate">Contacts</span>
          </Button>
          <Button
            onClick={() => setShowNotificationPrefs(true)}
            variant="outline"
            size="sm"
            className="w-full min-h-[44px] text-xs sm:text-sm"
          >
            <Bell className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="truncate">Notifications</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeView} onValueChange={value => setActiveView(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mx-auto max-w-sm mt-2 sm:mt-4 sticky top-0 z-10 bg-background h-12">
          <TabsTrigger value="sos" className="text-xs sm:text-sm data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
            SOS
          </TabsTrigger>
          <TabsTrigger value="nearby" className="text-xs sm:text-sm data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
            Nearby
          </TabsTrigger>
          <TabsTrigger value="profile" className="text-xs sm:text-sm data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
            Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sos" className="mt-4">
          <ErrorBoundary fallbackMessage="Failed to load SOS emergency view">
            <SOSEmergencyView />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="nearby" className="mt-4">
          <ErrorBoundary fallbackMessage="Failed to load nearby alerts">
            <Suspense fallback={
              <div className="flex items-center justify-center p-8">
                <SerkleLoader size="md" className="text-primary" />
              </div>
            }>
              <SOSNearbyView />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <ErrorBoundary fallbackMessage="Failed to load helper profile">
            <SOSProfile />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </main>

    <EmergencyContactsModal
      isOpen={showContactsModal}
      onClose={() => setShowContactsModal(false)}
    />

    <NotificationPreferencesModal
      isOpen={showNotificationPrefs}
      onClose={() => setShowNotificationPrefs(false)}
    />

    <FooterNav active={activeTab} onSelect={onTabSelect} onOpenCreate={onOpenCreate} />
  </div>;
};
export default Safe;