import React, { useState } from 'react';
import { Camera, UserPlus, Radio, Video, MessagesSquare } from 'lucide-react';
import { HomeIcon, CirclesIcon, CreateIcon, AskIcon, MessagesIcon } from '@/components/icons/FooterIcons';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAppNav, type TabKey } from '@/hooks/useAppNav';
import { useUser } from '@/contexts/UserContext';
import { useConversations } from '@/hooks/useConversations';
import { useUnreadCount } from '@/hooks/useUnreadCount';

interface FooterNavProps {
  active: TabKey;
  onSelect: (key: TabKey) => void;
  onOpenCreate: () => void;
  onOpenGoLive?: () => void;
  onOpenStoryModal?: () => void;
  onOpenQuestionForm?: () => void;
  videoMode?: boolean;
}

const TABS = [
  { key: "home" as const, label: "Home", icon: HomeIcon },
  { key: "circles" as const, label: "Circles", icon: CirclesIcon },
  { key: "add" as const, label: "Add", icon: CreateIcon, center: true },
  { key: "ask" as const, label: "Ask Anonymously", icon: AskIcon },
  { key: "messages" as const, label: "Messages", icon: MessagesIcon },
];

const CREATE_OPTIONS = [
  { label: "Post", icon: Camera },
  { label: "Video", icon: Video },
  { label: "Circle", icon: UserPlus },
  { label: "Group Chat", icon: MessagesSquare },
  { label: "Go live", icon: Radio },
];

const NavImageIcon: React.FC<{ src: string; className?: string }> = ({ src, className = 'size-7' }) => (
  <img
    src={src}
    alt=""
    aria-hidden="true"
    draggable={false}
    decoding="async"
    className={`object-contain ${className}`}
  />
);

const NavLabel: React.FC<{ active: boolean; children: React.ReactNode }> = ({ active, children }) => (
  active ? null : (
    <span className="text-[9px] leading-[10px] font-medium text-muted-foreground">
      {children}
    </span>
  )
);

const FooterNavSurface: React.FC<{ videoMode?: boolean }> = ({ videoMode = false }) => (
  <svg
    aria-hidden="true"
    className={`pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible ${videoMode ? '' : 'drop-shadow-[0_8px_18px_rgba(15,23,42,0.12)]'}`}
    style={{
      // Mask in CSS pixels so the opening stays circular at every navbar width.
      // Only the surface is masked; the independently centered button stays visible.
      maskImage: `radial-gradient(circle at center, transparent ${videoMode ? 21 : 24}px, black ${videoMode ? 21.5 : 24.5}px)`,
      WebkitMaskImage: `radial-gradient(circle at center, transparent ${videoMode ? 21 : 24}px, black ${videoMode ? 21.5 : 24.5}px)`,
    }}
    viewBox="0 0 1000 1000"
    preserveAspectRatio="none"
  >
    <path
      d={videoMode
        ? 'M0 0 H1000 V1000 H0 Z'
        : 'M60 0 H940 A60 500 0 0 1 1000 500 A60 500 0 0 1 940 1000 H60 A60 500 0 0 1 0 500 A60 500 0 0 1 60 0 Z'}
      fill="hsl(var(--card))"
      stroke={videoMode ? 'none' : 'hsl(var(--border))'}
      strokeWidth="1"
      vectorEffect="non-scaling-stroke"
    />
    {videoMode && (
      <path
        d="M0 0 H1000"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    )}
  </svg>
);

const FooterNav: React.FC<FooterNavProps> = ({ active, onSelect, onOpenCreate, onOpenGoLive, onOpenStoryModal, onOpenQuestionForm, videoMode = false }) => {
  const navigate = useNavigate();
  const { navigateToTab, navigateToCreatePost, navigateToCreateVideo, navigateToCreateCircle, navigateToCreateShop, navigateToMessages } = useAppNav();
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const { user } = useUser();
  const { totalUnreadCount: totalUnreadMessages } = useUnreadCount();

  const formatBadge = (count: number) => count > 99 ? '99+' : String(count);

  const handleCreateClick = () => {
    if (active === 'ask' && onOpenQuestionForm) {
      onOpenQuestionForm();
    } else {
      setShowCreatePopup(!showCreatePopup);
    }
  };

  const handleCreateOptionClick = (option: string) => {
    setShowCreatePopup(false);
    if (option === 'Go live') {
      toast('Coming soon!', { description: 'Live streaming will be available soon.' });
    } else if (option === 'Post') {
      navigateToCreatePost();
    } else if (option === 'Video') {
      navigateToCreateVideo();
    } else if (option === 'Circle') {
      navigateToCreateCircle();
    } else if (option === 'Group Chat') {
      navigate('/messages?createGroup=true');
    }
  };

  const handleTabClick = (tabKey: TabKey) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // If it's a "special" tab like 'messages' or 'safe', handle accordingly
    if (tabKey === 'messages') {
      navigateToMessages();
    } else if (tabKey === 'home' || tabKey === 'circles' || tabKey === 'ask' || tabKey === 'shop') {
      navigateToTab(tabKey);
    }
    
    // Notify parent of the selection
    if (typeof onSelect === 'function') {
      onSelect(tabKey);
    }
  };
  if (videoMode) {
    return (
      <nav 
        aria-label="Primary" 
        className="serkle-footer-nav serkle-footer-nav--enter relative w-full h-[50px] flex items-center justify-center bg-transparent"
        role="tablist"
      >
        <FooterNavSurface videoMode />
        <div className="relative z-[1] grid grid-cols-5 place-items-center h-full w-full max-w-md px-4">
          <button
            type="button"
            role="tab"
            aria-selected={active === "home"}
            aria-current={active === "home" ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-px size-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-all ${
              active === "home" ? 'bg-card/20' : 'hover:bg-card/10'
            }`}
            onClick={() => handleTabClick("home")}
            title="Home"
            aria-label="Home"
          >
            <HomeIcon active={active === "home"} className="size-7" />
            <NavLabel active={active === "home"}>Home</NavLabel>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={active === "circles"}
            className={`flex flex-col items-center justify-center gap-px size-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors ${
              active === "circles" ? 'bg-card/20' : 'hover:bg-card/10'
            }`}
            onClick={() => handleTabClick("circles")}
            title="Circles"
            aria-label="Circles"
          >
            <CirclesIcon active={active === "circles"} className="size-7" />
            <NavLabel active={active === "circles"}>Circles</NavLabel>
          </button>

          <div className="relative size-10">
            <button
              type="button"
              role="tab"
              aria-selected={active === "add"}
              className="serkle-create-button absolute left-1/2 top-1/2 z-10 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/80 shadow-[0_2px_4px_rgba(111,73,38,0.2)] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B99065]"
              onClick={handleCreateClick}
              title={active === 'ask' ? 'Share Story' : 'Create'}
              aria-label={active === 'ask' ? 'Share Story' : 'Create'}
            >
              <NavImageIcon
                src="/nav-icons/create-white.svg"
                className={`size-5 drop-shadow-[0_1px_2px_rgba(88,49,16,0.3)] transition-transform duration-300 ease-out motion-reduce:transition-none ${showCreatePopup ? 'rotate-45' : 'rotate-0'}`}
              />
            </button>
            
            {showCreatePopup && active !== 'ask' && (
              <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-card rounded-full shadow-lg border border-border transition-opacity duration-200">
                <div className="flex items-center justify-center px-4 py-2">
                  {CREATE_OPTIONS.map((option, index) => {
                    const IconComponent = option.icon;
                    return (
                      <button
                        key={option.label}
                        onClick={() => handleCreateOptionClick(option.label)}
                        className="flex flex-col items-center justify-center py-2 px-3 rounded-xl hover:bg-muted/50 transition-colors group min-w-[50px]"
                      >
                        <IconComponent className="size-4 text-primary group-hover:text-primary/80 transition-colors mb-1" />
                        <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors font-medium whitespace-nowrap">
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            role="tab"
            aria-selected={active === "ask"}
            className={`flex flex-col items-center justify-center gap-px size-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors ${
              active === "ask" ? 'bg-card/20' : 'hover:bg-card/10'
            }`}
            onClick={() => handleTabClick("ask")}
            title="Ask Anonymously"
            aria-label="Ask Anonymously"
          >
            {active === 'ask' ? (
              <NavImageIcon src="/nav-icons/ask-active.webp" />
            ) : (
              <NavImageIcon src="/nav-icons/ask-inactive.webp" className="size-7 nav-inactive-icon" />
            )}
            <NavLabel active={active === "ask"}>Ask</NavLabel>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={active === "messages"}
            className={`relative flex flex-col items-center justify-center gap-px size-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors ${
              active === "messages" ? 'bg-card/20' : 'hover:bg-card/10'
            }`}
            onClick={() => handleTabClick("messages")}
            title="Messages"
            aria-label="Messages"
          >
            {active === 'messages' ? (
              <NavImageIcon src="/nav-icons/messages-active.svg" />
            ) : (
              <NavImageIcon src="/nav-icons/messages-inactive.svg" className="size-7 nav-inactive-icon" />
            )}
            <NavLabel active={active === "messages"}>Messages</NavLabel>
            {totalUnreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] grid place-items-center bg-destructive text-white font-medium">
                {formatBadge(totalUnreadMessages)}
              </span>
            )}
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav 
      aria-label="Primary" 
      className="serkle-footer-nav serkle-footer-nav--enter fixed inset-x-0 z-40 pointer-events-none" 
      style={{ bottom: `calc(env(safe-area-inset-bottom) + 12px)` }}
    >
      <div className="mx-auto max-w-[480px] relative">
        <div className="pointer-events-auto relative mx-auto h-14 w-[92%]">
          <FooterNavSurface />
          <div className="relative z-[1] grid h-full grid-cols-5 place-items-center px-2" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={active === "home"}
              aria-current={active === "home" ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-px size-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-all ${
                active === "home" ? 'bg-tertiary' : 'hover:bg-muted/30'
              }`}
              onClick={() => handleTabClick("home")}
              title="Home"
              aria-label="Home"
              data-testid="nav-home"
            >
              <HomeIcon active={active === "home"} className="size-7" />
              <NavLabel active={active === "home"}>Home</NavLabel>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={active === "circles"}
              className={`flex flex-col items-center justify-center gap-px size-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors ${
                active === "circles" ? 'bg-tertiary' : 'hover:bg-muted/30'
              }`}
              onClick={() => handleTabClick("circles")}
              title="Circles"
              aria-label="Circles"
              data-testid="nav-circles"
            >
              <CirclesIcon active={active === "circles"} className="size-7" />
              <NavLabel active={active === "circles"}>Circles</NavLabel>
            </button>

              <div className="relative size-10">
              <button
                type="button"
                role="tab"
                aria-selected={active === "add"}
                className="serkle-create-button absolute left-1/2 top-1/2 z-10 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/80 shadow-[0_2px_4px_rgba(111,73,38,0.2)] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B99065]"
                onClick={handleCreateClick}
                title={active === 'ask' ? 'Share Story' : 'Create'}
                aria-label={active === 'ask' ? 'Share Story' : 'Create'}
                data-testid="nav-add"
              >
                <NavImageIcon
                  src="/nav-icons/create-white.svg"
                  className={`size-5 drop-shadow-[0_1px_2px_rgba(88,49,16,0.3)] transition-transform duration-300 ease-out motion-reduce:transition-none ${showCreatePopup ? 'rotate-45' : 'rotate-0'}`}
                />
              </button>
              
              {showCreatePopup && active !== 'ask' && (
                <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-card rounded-full shadow-lg border border-border transition-opacity duration-200" data-testid="create-popup">
                  <div className="flex items-center justify-center px-4 py-2">
                    {CREATE_OPTIONS.map((option, index) => {
                      const IconComponent = option.icon;
                      return (
                        <button
                          key={option.label}
                          onClick={() => handleCreateOptionClick(option.label)}
                          className="flex flex-col items-center justify-center py-2 px-3 rounded-xl hover:bg-muted/50 transition-colors group min-w-[50px]"
                          data-testid={`create-${option.label.toLowerCase().replace(' ', '-')}`}
                        >
                          <IconComponent className="size-4 text-primary group-hover:text-primary/80 transition-colors mb-1" />
                          <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors font-medium whitespace-nowrap">
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              role="tab"
              aria-selected={active === "ask"}
              className={`flex flex-col items-center justify-center gap-px size-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors ${
                active === "ask" ? 'bg-tertiary' : 'hover:bg-muted/30'
              }`}
              onClick={() => handleTabClick("ask")}
              title="Ask Anonymously"
              aria-label="Ask Anonymously"
              data-testid="nav-ask"
            >
              {active === 'ask' ? (
                <NavImageIcon src="/nav-icons/ask-active.webp" />
              ) : (
                <NavImageIcon src="/nav-icons/ask-inactive.webp" className="size-7 nav-inactive-icon" />
              )}
              <NavLabel active={active === "ask"}>Ask</NavLabel>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={active === "messages"}
              className={`relative flex flex-col items-center justify-center gap-px size-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors ${
                active === "messages" ? 'bg-tertiary' : 'hover:bg-muted/30'
              }`}
              onClick={() => handleTabClick("messages")}
              title="Messages"
              aria-label="Messages"
              data-testid="nav-messages"
            >
              {active === 'messages' ? (
                <NavImageIcon src="/nav-icons/messages-active.svg" />
              ) : (
                <NavImageIcon src="/nav-icons/messages-inactive.svg" className="size-7 nav-inactive-icon" />
              )}
              <NavLabel active={active === "messages"}>Messages</NavLabel>
              {totalUnreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] grid place-items-center bg-destructive text-white font-medium">
                  {formatBadge(totalUnreadMessages)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default FooterNav;
