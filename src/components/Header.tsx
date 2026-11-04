import React, { useState } from 'react';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Bell, Mail, Settings, User as UserIcon, Palette, LogOut, ShoppingBag, RotateCw, Search, Sun, Moon, Monitor, Coins } from 'lucide-react';
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
import { useTheme } from '@/contexts/ThemeContext';
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

const MenuItem = ({ icon, label, danger, badge, onClick, 'data-testid': dataTestId }: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  badge?: number;
  onClick?: () => void;
  'data-testid'?: string;
}) => (
  <button
    type="button"
    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors relative"
    style={{ color: danger ? "hsl(var(--destructive))" : undefined }}
    role="menuitem"
    onClick={onClick}
    data-testid={dataTestId}
  >
    <span className="text-foreground">{icon}</span>
    <span className="text-sm text-foreground flex-1">{label}</span>
    {typeof badge === "number" && badge > 0 && (
      <span
        className="min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] grid place-items-center bg-destructive text-white font-medium"
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
  const [showThemePicker, setShowThemePicker] = useState(false);
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
  const { theme, setTheme } = useTheme();

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
  const { balance } = useCoinWallet(user?.id);
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

            <button
              type="button"
              className="ml-1 inline-flex items-center gap-2 rounded-full px-2 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => {
                if (!menuOpen) handleOpenMenu();
                else setMenuOpen(false);
              }}
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
          </div>
        </div>
      </div>

      {menuOpen && (
        <>
          <button
            aria-label="Close profile menu"
            className="fixed inset-0 z-30"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="absolute right-3 top-10 z-40 w-64 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl animate-scale-in"
            role="menu"
            data-testid="user-menu"
          >
            <div className="p-3 bg-gradient-hero">
              <button
                type="button"
                className="flex items-center gap-3 w-full hover:bg-card/10 rounded-lg p-2 transition-colors"
                onClick={() => {
                  handleOpenProfile();
                  setMenuOpen(false);
                }}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="text-sm font-medium bg-gradient-to-br from-primary to-secondary text-white">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-primary">{user.name}</div>
                  <div className="text-xs text-muted-foreground">@{user.username}</div>
                </div>
              </button>
            </div>
            {/* Coin Balance */}
            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors"
              onClick={() => {
                handleOpenWallet();
                setMenuOpen(false);
              }}
            >
              <div className="flex items-center gap-2 flex-1">
                <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Coins className="size-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">{balance.toLocaleString()} Coins</p>
                  <p className="text-[10px] text-muted-foreground">≈ ${balance.toLocaleString()}.00</p>
                </div>
              </div>
              <span className="text-xs text-primary font-medium">Top Up</span>
            </button>
            <div className="h-px bg-border" />
            <MenuItem
              icon={<Search className="size-4" />}
              label="Search"
              onClick={() => {
                handleOpenSearch();
                setMenuOpen(false);
              }}
            />
            <MenuItem
              icon={<UserIcon className="size-4" />}
              label="View profile"
              onClick={() => {
                handleOpenProfile();
                setMenuOpen(false);
              }}
            />
            <MenuItem
              icon={<Mail className="size-4" />}
              label="Messages"
              badge={totalUnreadMessages}
              onClick={() => {
                navigateToMessages();
                setMenuOpen(false);
              }}
              data-testid="menu-messages"
            />
            <MenuItem
              icon={<Settings className="size-4" />}
              label="Settings"
              onClick={() => {
                handleOpenSettings();
                setMenuOpen(false);
              }}
            />
            <MenuItem
              icon={<Palette className="size-4" />}
              label="Appearance"
              onClick={() => setShowThemePicker(!showThemePicker)}
            />
            {showThemePicker && (
              <div className="px-3 py-2 space-y-1 bg-muted/50">
                {[
                  { value: 'light' as const, label: 'Light', icon: <Sun className="size-4" /> },
                  { value: 'dark' as const, label: 'Dark', icon: <Moon className="size-4" /> },
                  { value: 'system' as const, label: 'System', icon: <Monitor className="size-4" /> },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${theme === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-background text-foreground'
                      }`}
                    onClick={() => {
                      setTheme(opt.value);
                      setShowThemePicker(false);
                    }}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <MenuItem
              icon={<RotateCw className="size-4" />}
              label="Clear cache & refresh"
              onClick={() => {
                cacheManager.forceRefresh();
              }}
            />
            <div className="h-px bg-border" />
            <MenuItem
              icon={<LogOut className="size-4" />}
              label="Log out"
              danger
              onClick={async () => {
                setMenuOpen(false);
                await supabase.auth.signOut();
                navigate('/login', { replace: true });
              }}
              data-testid="menu-logout"
            />
          </div>
        </>
      )}

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
