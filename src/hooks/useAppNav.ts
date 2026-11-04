import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export type TabKey = "home" | "circles" | "add" | "ask" | "safe" | "shop" | "messages";

export interface AppNavigation {
  navigateToTab: (tab: TabKey) => void;
  navigateToNotifications: () => void;
  navigateToMessages: () => void;
  navigateToShop: () => void;
  navigateToCreatePost: () => void;
  navigateToCreateVideo: () => void;
  navigateToCreateCircle: () => void;
  navigateToCreateShop: () => void;
}

export const useAppNav = (): AppNavigation => {
  const navigate = useNavigate();

  const navigateToTab = useCallback((tab: TabKey) => {
    switch (tab) {
      case 'home':
        navigate('/', { state: { activeTab: 'home' } });
        break;
      case 'circles':
        navigate('/', { state: { activeTab: 'circles' } });
        break;
      case 'ask':
        navigate('/ask');
        break;
      case 'safe':
        navigate('/', { state: { activeTab: 'safe' } });
        break;
      case 'shop':
        navigate('/shop');
        break;
      default:
        navigate('/');
    }
  }, [navigate]);

  const navigateToNotifications = useCallback(() => {
    navigate('/notifications');
  }, [navigate]);

  const navigateToMessages = useCallback(() => {
    navigate('/messages');
  }, [navigate]);

  const navigateToShop = useCallback(() => {
    navigate('/shop');
  }, [navigate]);

  const navigateToCreatePost = useCallback(() => {
    navigate('/create/post');
  }, [navigate]);

  const navigateToCreateVideo = useCallback(() => {
    navigate('/create/video');
  }, [navigate]);

  const navigateToCreateCircle = useCallback(() => {
    navigate('/create/circle');
  }, [navigate]);

  const navigateToCreateShop = useCallback(() => {
    navigate('/create/shop');
  }, [navigate]);

  return {
    navigateToTab,
    navigateToNotifications,
    navigateToMessages,
    navigateToShop,
    navigateToCreatePost,
    navigateToCreateVideo,
    navigateToCreateCircle,
    navigateToCreateShop,
  };
};