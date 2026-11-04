import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAndroid } from '@/lib/capacitorUtils';

/**
 * Handles the Android hardware back button.
 * - Navigates back if history is available.
 * - Minimises (backgrounds) the app if at the root, to avoid accidental closure.
 * - Gracefully falls back to logical parent pages if deep-linked without history.
 */
export const useAndroidBackButton = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!isAndroid()) return;

        let handle: { remove: () => void } | undefined;

        (async () => {
            const { App } = await import('@capacitor/app');

            handle = await App.addListener('backButton', ({ canGoBack }) => {
                const hasHistory = window.history.state && window.history.state.idx > 0;

                if (hasHistory) {
                    navigate(-1);
                } else {
                    const path = window.location.pathname;
                    const rootPaths = ['/', '/login', '/signup', '/messages', '/notifications', '/shop', '/cart', '/profile'];
                    const isRootPath = rootPaths.includes(path) || path.match(/^\/profile\/[^\/]+$/);

                    if (isRootPath) {
                        App.minimizeApp();
                    } else {
                        // We are deep in the app but have no history, fallback to a logical parent
                        if (path.startsWith('/messages/')) {
                            navigate('/messages', { replace: true });
                        } else if (path.startsWith('/shop/product/')) {
                            navigate('/shop', { replace: true });
                        } else if (path.startsWith('/circle/')) {
                            navigate('/', { replace: true });
                        } else if (path.startsWith('/post/')) {
                            navigate('/', { replace: true });
                        } else {
                            navigate('/', { replace: true });
                        }
                    }
                }
            });
        })();

        return () => {
            if (handle) handle.remove();
        };
    }, [navigate, location]);
};
