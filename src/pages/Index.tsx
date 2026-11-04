import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { type TabKey } from '@/hooks/useAppNav';
import { usePersistedNavState } from '@/hooks/usePersistedNavState';
import Header from '../components/Header';
import StoriesBar from '../components/StoriesBar';
import { FeedView } from '../components/FeedView';
import { RelaxView } from '../components/RelaxView';
import { FeedRelaxToggle } from '../components/FeedRelaxToggle';
import FooterNav from '../components/FooterNav';
import { useNavigation } from '@/contexts/NavigationContext';
import CreateModal from '../components/CreateModal';
import GoLiveModal from '../components/live/GoLiveModal';
import { InstallPrompt } from '../components/InstallPrompt';
import Circles from './Circles';
import Shop from './Shop';
import Safe from './Safe';

const Index = () => {
  const location = useLocation();
  const {
    activeTab, setActiveTab,
    feedMode, setFeedMode,
    restoreScrollPosition,
  } = usePersistedNavState();

  const { pushModalState } = useNavigation();
  const [openCreate, setOpenCreate] = useState(false);
  const [openGoLive, setOpenGoLive] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [headerProfileOpen, setHeaderProfileOpen] = useState(false);
  const [headerSettingsOpen, setHeaderSettingsOpen] = useState(false);
  const [headerWalletOpen, setHeaderWalletOpen] = useState(false);
  const [headerNotificationsOpen, setHeaderNotificationsOpen] = useState(false);

  // Restore scroll when returning to the page
  useEffect(() => {
    restoreScrollPosition();
  }, [restoreScrollPosition]);

  // Handle navigation state passed via router
  const [initialVideoId, setInitialVideoId] = useState<string | undefined>();
  const [initialOpenComments, setInitialOpenComments] = useState(false);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      window.history.replaceState({}, document.title);
    }
    if (location.state?.feedMode === 'relax') {
      setFeedMode('relax');
      if (location.state?.videoId) {
        setInitialVideoId(location.state.videoId);
      }
      if (location.state?.openComments) {
        setInitialOpenComments(true);
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, setActiveTab, setFeedMode]);

  // Auto-open create modal when Add tab is selected
  useEffect(() => {
    if (activeTab === 'add') {
      handleOpenCreate();
    }
  }, [activeTab]);

  const handleCloseCreate = () => {
    setOpenCreate(false);
    if (activeTab === 'add') setActiveTab('home');
  };

  const handleTabSelect = (tab: TabKey) => {
    if (tab === 'home') setFeedMode('feed');
    setActiveTab(tab);
  };

  const handleOpenCreate = () => {
    pushModalState('create', handleCloseCreate);
    setOpenCreate(true);
  };
  const handleOpenGoLive = () => {
    pushModalState('go-live', () => setOpenGoLive(false));
    setOpenGoLive(true);
  };

  // Render sub-views based on active tab
  if (activeTab === 'circles') {
    return (
      <Circles
        activeTab={activeTab}
        onTabSelect={handleTabSelect}
        onOpenCreate={handleOpenCreate}
      />
    );
  }

  if (activeTab === 'safe') {
    return (
      <Safe
        activeTab={activeTab}
        onTabSelect={handleTabSelect}
        onOpenCreate={handleOpenCreate}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] mx-auto bg-background text-foreground selection:bg-secondary/40 max-w-[480px] relative border-l border-r border-border font-sans" data-testid="app-loaded">
      <InstallPrompt />
      <Header
        onNotificationPanelChange={setHeaderNotificationsOpen}
        onMenuOpenChange={setHeaderMenuOpen}
        onProfileModalChange={setHeaderProfileOpen}
        onSettingsModalChange={setHeaderSettingsOpen}
        onWalletModalChange={setHeaderWalletOpen}
      />

      <main className="pb-24">
        <StoriesBar />

        {!headerMenuOpen && !headerProfileOpen && !headerSettingsOpen && !headerWalletOpen && !headerNotificationsOpen && (
          <FeedRelaxToggle activeMode={feedMode} onModeChange={setFeedMode} />
        )}

        {feedMode === 'feed' ? (
          <FeedView data-testid="feed-view" />
        ) : (
          <RelaxView
            autoOpenFirstVideo
            initialVideoId={initialVideoId}
            initialOpenComments={initialOpenComments}
            onBackToFeed={() => setFeedMode('feed')}
            activeTab={activeTab}
            onTabSelect={handleTabSelect}
            onOpenCreate={handleOpenCreate}
          />
        )}
      </main>

      <FooterNav
        active={activeTab}
        onSelect={handleTabSelect}
        onOpenCreate={handleOpenCreate}
        onOpenGoLive={handleOpenGoLive}
      />

      <CreateModal isOpen={openCreate} onClose={handleCloseCreate} />
      <GoLiveModal isOpen={openGoLive} onClose={() => setOpenGoLive(false)} />
    </div>
  );
};

export default Index;
