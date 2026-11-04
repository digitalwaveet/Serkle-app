import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { isNative } from '@/lib/capacitorUtils';

type NetworkStatus = {
    isOnline: boolean;
};

export const useNetworkStatus = (): NetworkStatus => {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        let cleanup: (() => void) | undefined;

        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Back online');
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.error('You are offline. Some features may be unavailable.');
        };

        if (isNative()) {
            // Use @capacitor/network for native
            (async () => {
                const { Network } = await import('@capacitor/network');
                const status = await Network.getStatus();
                setIsOnline(status.connected);

                const handle = await Network.addListener('networkStatusChange', (newStatus) => {
                    if (newStatus.connected) {
                        handleOnline();
                    } else {
                        handleOffline();
                    }
                });

                cleanup = () => handle.remove();
            })();
        } else {
            // Web fallback
            setIsOnline(navigator.onLine);
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
            cleanup = () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            };
        }

        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    return { isOnline };
};
