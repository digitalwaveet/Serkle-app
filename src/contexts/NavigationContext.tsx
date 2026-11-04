import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';

interface NavigationContextType {
  registerStopper: (id: string, closeFn: () => void) => void;
  unregisterStopper: (id: string) => void;
  pushModalState: (id: string, closeFn: () => void) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stoppersRef = useRef<Map<string, () => void>>(new Map());
  const activeStopperIdRef = useRef<string | null>(null);

  const unregisterStopper = useCallback((id: string) => {
    stoppersRef.current.delete(id);
    if (activeStopperIdRef.current === id) {
      activeStopperIdRef.current = null;
    }
  }, []);

  const registerStopper = useCallback((id: string, closeFn: () => void) => {
    stoppersRef.current.set(id, closeFn);
  }, []);

  const pushModalState = useCallback((id: string, closeFn: () => void) => {
    registerStopper(id, closeFn);
    activeStopperIdRef.current = id;
    // Push a dummy state to history so back button triggers popstate
    window.history.pushState({ isModal: true, modalId: id }, '');
  }, [registerStopper]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If we were in a modal state and just popped out of it
      if (activeStopperIdRef.current) {
        const stopperId = activeStopperIdRef.current;
        const closeFn = stoppersRef.current.get(stopperId);
        
        if (closeFn) {
          closeFn();
          activeStopperIdRef.current = null;
          // We successfully handled the back press by closing a modal
          return;
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <NavigationContext.Provider value={{ registerStopper, unregisterStopper, pushModalState }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
