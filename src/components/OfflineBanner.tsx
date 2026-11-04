import { isNative } from '@/lib/capacitorUtils';

interface OfflineBannerProps {
    isOnline: boolean;
}

export const OfflineBanner = ({ isOnline }: OfflineBannerProps) => {
    if (isOnline) return null;

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-destructive text-destructive-foreground py-2 px-4 text-sm font-medium animate-slide-down"
            style={{ paddingTop: isNative() ? 'calc(env(safe-area-inset-top) + 8px)' : '8px' }}
        >
            <span className="h-2 w-2 rounded-full bg-destructive-foreground animate-pulse" />
            No internet connection
        </div>
    );
};
