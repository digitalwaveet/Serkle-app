import React, { useState } from 'react';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Bell, Mail, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/contexts/UserContext';
import { useAppNav } from '@/hooks/useAppNav';
import { useNavigate } from 'react-router-dom';
import ProfileModal from './ProfileModal';
import SettingsModal from './SettingsModal';
import SearchModal from './SearchModal';
import WalletModal from './wallet/WalletModal';
import { cacheManager } from '@/utils/cacheManager';
import { useNotifications } from '@/hooks/useNotifications';
import { useConversations } from '@/hooks/useConversations';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { supabase } from '@/integrations/supabase/client';
import { ProfileDropdown } from './ProfileDropdown';
import { useNavigation } from '@/contexts/NavigationContext';

import NotificationPanel from './notifications/NotificationPanel';

interface HeaderProps {
  onNotifications?: () => void;
  onMessages?: () => void;
  onMenuOpenChange?: (isOpen: boolean) => void;
  onProfileModalChange?: (isOpen: boolean) => void;
  onSettingsModalChange?: (isOpen: boolean) => void;
  onWalletModalChange?: (isOpen: boolean) => void;
  onNotificationPanelChange?: (isOpen: boolean) => void;
}

const IconButton = ({ label, children, badge, onClick, 'data-testid': dataTestId }: {
  label: string;
  children: React.ReactNode;
  badge?: number;
  onClick?: () => void;
  'data-testid'?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="relative p-1.5 rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors"
    aria-label={label}
    title={label}
    data-testid={dataTestId}
  >
    {children}
    {typeof badge === "number" && badge > 0 && (
      <span
        className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] grid place-items-center bg-secondary text-white font-medium"
        aria-label={`${badge} unread`}
      >
        {badge}
      </span>
    )}
  </button>
);

const Header: React.FC<HeaderProps> = ({ onNotifications, onMessages, onMenuOpenChange, onProfileModalChange, onSettingsModalChange, onWalletModalChange, onNotificationPanelChange }) => {
  const { navigateToNotifications, navigateToMessages, navigateToShop } = useAppNav();
  const navigate = useNavigate();
  const { pushModalState } = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  const handleOpenMenu = () => {
    pushModalState('header-menu', () => setMenuOpen(false));
    setMenuOpen(true);
  };
  const handleOpenProfile = () => {
    pushModalState('header-profile', () => setShowProfileModal(false));
    setShowProfileModal(true);
  };
  const handleOpenSearch = () => {
    pushModalState('header-search', () => setShowSearchModal(false));
    setShowSearchModal(true);
  };
  const handleOpenSettings = () => {
    pushModalState('header-settings', () => setShowSettingsModal(false));
    setShowSettingsModal(true);
  };
  const handleOpenWallet = () => {
    pushModalState('header-wallet', () => setShowWalletModal(false));
    setShowWalletModal(true);
  };
  const handleOpenNotifications = () => {
    pushModalState('header-notifications', () => setShowNotificationPanel(false));
    setShowNotificationPanel(true);
  };
  const { unreadCount } = useNotifications();


  React.useEffect(() => {
    onMenuOpenChange?.(menuOpen);
  }, [menuOpen, onMenuOpenChange]);

  React.useEffect(() => {
    onProfileModalChange?.(showProfileModal);
  }, [showProfileModal, onProfileModalChange]);

  React.useEffect(() => {
    onSettingsModalChange?.(showSettingsModal);
  }, [showSettingsModal, onSettingsModalChange]);

  React.useEffect(() => {
    onWalletModalChange?.(showWalletModal);
  }, [showWalletModal, onWalletModalChange]);

  React.useEffect(() => {
    onNotificationPanelChange?.(showNotificationPanel);
  }, [showNotificationPanel, onNotificationPanelChange]);

  // Handle URL parameters to auto-open wallet or settings
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('wallet') === 'open' || params.get('verify_topup')) {
      handleOpenWallet();
      // Clean up URL without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (params.get('view') === 'notifications') {
      handleOpenSettings();
      // Clean up URL without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);
  const { user, isLoading } = useUser();
  const { balance, isWalletLoading, isWalletError } = useCoinWallet(user?.id);
  const { totalUnreadCount: totalUnreadMessages } = useUnreadCount();

  if (isLoading || !user) {
    return (
      <header className="sticky top-0 z-30 border-b border-border">
        <div className="bg-background">
          <div className="px-4 h-10 flex items-center justify-between">
            <div className="flex items-center justify-center">
              <img
                src="/lovable-uploads/SerkleSecondaryLogo.svg"
                alt="Serkle"
                className="h-6 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-1">
              <SerkleLoader size="xs" label="Loading account" />
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border">
      <div className="bg-background">
        <div className="px-4 h-10 flex items-center justify-between">
          <div className="flex items-center justify-center">
            <img
              src="/lovable-uploads/SerkleSecondaryLogo.svg"
              alt="Serkle"
              className="h-6 w-auto object-contain"
            />
          </div>

          <div className="flex items-center gap-1">
            <div className="relative">
              <IconButton
                label="Notifications"
                badge={unreadCount}
                onClick={() => {
                  if (showNotificationPanel) {
                    setShowNotificationPanel(false);
                  } else {
                    handleOpenNotifications();
                  }
                }}
                data-testid="header-notifications"
              >
                <Bell className="size-4 text-primary" />
              </IconButton>

              <NotificationPanel
                isOpen={showNotificationPanel}
                onClose={() => setShowNotificationPanel(false)}
              />
            </div>
            <IconButton
              label="Search"
              onClick={handleOpenSearch}
              data-testid="header-search"
            >
              <Search className="size-4 text-primary" />
            </IconButton>

            <ProfileDropdown
              user={user}
              open={menuOpen}
              onOpenChange={open => { if (open) handleOpenMenu(); else setMenuOpen(false); }}
              balance={balance}
              isBalanceLoading={isWalletLoading}
              isBalanceError={isWalletError}
              unreadMessages={totalUnreadMessages}
              onProfile={handleOpenProfile}
              onSearch={handleOpenSearch}
              onWallet={handleOpenWallet}
              onSettings={handleOpenSettings}
              onMessages={navigateToMessages}
              onRefresh={() => cacheManager.forceRefresh()}
              onLogout={async () => { await supabase.auth.signOut(); navigate('/login', { replace: true }); }}
            >
              <button
                type="button"
                className="ml-1 inline-flex items-center gap-2 rounded-full px-2 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors"
                aria-label="Open profile menu"
                data-testid="header-user-menu"
              >
                <span className="relative inline-block">
                  <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-primary to-secondary text-white">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  {user.isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-white bg-success" />
                  )}
                </span>
                <span className="hidden sm:inline text-sm text-primary">{user.name}</span>
              </button>
            </ProfileDropdown>
          </div>
        </div>
      </div>

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      <WalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />
    </header>
  );
};

export default Header;
