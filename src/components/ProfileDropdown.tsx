import { useRef, type ReactNode } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { ArrowUpRight, Check, ChevronRight, Coins, LogOut, Mail, Monitor, Moon, RotateCw, Search, Settings, Sun, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useTheme } from '@/contexts/ThemeContext';
import type { UserProfile } from '@/types/user';
import './profile-dropdown.css';

interface Props {
  user: Pick<UserProfile, 'name' | 'username' | 'avatar' | 'initials'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  balance: number;
  isBalanceLoading: boolean;
  isBalanceError: boolean;
  unreadMessages: number;
  onProfile: () => void;
  onSearch: () => void;
  onWallet: () => void;
  onMessages: () => void;
  onSettings: () => void;
  onRefresh: () => void;
  onLogout: () => void | Promise<void>;
}

export function ProfileDropdown(props: Props) {
  const { theme, setTheme } = useTheme();
  const focusHandoff = useRef(false);
  const openModal = (action: () => void) => {
    focusHandoff.current = true;
    action();
  };

  return (
    <Menu.Root open={props.open} onOpenChange={open => {
      if (open) focusHandoff.current = false;
      props.onOpenChange(open);
    }}>
      <Menu.Trigger asChild>{props.children}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="profile-dropdown"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          data-testid="user-menu"
          aria-label="Profile menu"
          onCloseAutoFocus={event => {
            if (focusHandoff.current) event.preventDefault();
          }}
        >
          <Menu.Item className="profile-dropdown-identity" onSelect={() => openModal(props.onProfile)} aria-label={`Open profile for ${props.user.name}`}>
            <Avatar className="profile-dropdown-avatar">
              <AvatarImage src={props.user.avatar} alt="" />
              <AvatarFallback>{props.user.initials}</AvatarFallback>
            </Avatar>
            <div className="profile-dropdown-account">
              <span className="profile-dropdown-eyebrow">Your account</span>
              <strong>{props.user.name}</strong>
              <span className="profile-dropdown-handle">{props.user.username ? `@${props.user.username.replace(/^@/, '')}` : 'Serkle member'}</span>
            </div>
            <ChevronRight aria-hidden="true" className="profile-dropdown-chevron" />
          </Menu.Item>

          <Menu.Item className="profile-dropdown-wallet" onSelect={() => openModal(props.onWallet)}>
            <span className="profile-dropdown-wallet-icon"><Coins aria-hidden="true" /></span>
            <div className="profile-dropdown-wallet-copy">
              <span>Wallet</span>
              {props.isBalanceLoading ? <SerkleLoader size="xs" label="Loading coin balance" /> : props.isBalanceError ? <strong>Balance unavailable</strong> : <strong>{props.balance.toLocaleString()} <small>coins</small></strong>}
            </div>
            <ArrowUpRight aria-hidden="true" className="profile-dropdown-chevron" />
          </Menu.Item>

          <Menu.Group className="profile-dropdown-group" aria-label="Explore and connect">
            <Menu.Item className="profile-dropdown-item" onSelect={() => openModal(props.onSearch)}>
              <span className="profile-dropdown-icon"><Search aria-hidden="true" /></span>
              <span className="profile-dropdown-item-copy"><strong>Search</strong><small>Explore Serkle</small></span>
              <ChevronRight aria-hidden="true" className="profile-dropdown-chevron" />
            </Menu.Item>
            <Menu.Item className="profile-dropdown-item" onSelect={() => openModal(props.onProfile)}>
              <span className="profile-dropdown-icon"><UserRound aria-hidden="true" /></span>
              <span className="profile-dropdown-item-copy"><strong>View profile</strong><small>Your posts and profile</small></span>
              <ChevronRight aria-hidden="true" className="profile-dropdown-chevron" />
            </Menu.Item>
            <Menu.Item className="profile-dropdown-item" onSelect={props.onMessages} data-testid="menu-messages">
              <span className="profile-dropdown-icon"><Mail aria-hidden="true" /></span>
              <span className="profile-dropdown-item-copy"><strong>Messages</strong><small>Your conversations</small></span>
              {props.unreadMessages > 0 ? <span className="profile-dropdown-unread" aria-label={`${props.unreadMessages} unread messages`}>{props.unreadMessages.toLocaleString()}</span> : <ChevronRight aria-hidden="true" className="profile-dropdown-chevron" />}
            </Menu.Item>
          </Menu.Group>

          <Menu.Separator className="profile-dropdown-divider" />
          <Menu.Group className="profile-dropdown-group" aria-label="Preferences">
            <Menu.Item className="profile-dropdown-item" onSelect={() => openModal(props.onSettings)}>
              <span className="profile-dropdown-icon"><Settings aria-hidden="true" /></span>
              <span className="profile-dropdown-item-copy"><strong>Settings</strong><small>Account & preferences</small></span>
              <ChevronRight aria-hidden="true" className="profile-dropdown-chevron" />
            </Menu.Item>
            <div className="profile-dropdown-appearance">
              <Menu.Label>Appearance</Menu.Label>
              <Menu.RadioGroup value={theme} onValueChange={value => setTheme(value as 'light' | 'dark' | 'system')} className="profile-dropdown-themes" aria-label="Appearance">
                {([{ value: 'light', label: 'Light', Icon: Sun }, { value: 'dark', label: 'Dark', Icon: Moon }, { value: 'system', label: 'System', Icon: Monitor }] as const).map(({ value, label, Icon }) => (
                  <Menu.RadioItem key={value} value={value} className="profile-dropdown-theme" onSelect={event => event.preventDefault()}>
                    <Icon aria-hidden="true" /><span>{label}</span><Menu.ItemIndicator className="profile-dropdown-theme-check"><Check aria-hidden="true" /></Menu.ItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </div>
          </Menu.Group>

          <Menu.Separator className="profile-dropdown-divider" />
          <Menu.Group className="profile-dropdown-group profile-dropdown-footer" aria-label="Account actions">
            <Menu.Item className="profile-dropdown-item profile-dropdown-item--compact" onSelect={props.onRefresh}>
              <span className="profile-dropdown-icon"><RotateCw aria-hidden="true" /></span><span>Clear cache & refresh</span>
            </Menu.Item>
            <Menu.Item className="profile-dropdown-item profile-dropdown-item--compact profile-dropdown-logout" onSelect={() => { void props.onLogout(); }} data-testid="menu-logout">
              <span className="profile-dropdown-icon"><LogOut aria-hidden="true" /></span><span>Log out</span>
            </Menu.Item>
          </Menu.Group>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
