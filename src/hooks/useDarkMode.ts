import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'theme';

function applyTheme(mode: 'light' | 'dark') {
    document.documentElement.setAttribute('data-theme', mode);
}

export function useDarkMode() {
    const [isDark, setIsDark] = useState<boolean>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'dark';
    });

    useEffect(() => {
        const mode = isDark ? 'dark' : 'light';
        applyTheme(mode);
        localStorage.setItem(STORAGE_KEY, mode);
    }, [isDark]);

    const toggle = useCallback(() => setIsDark(prev => !prev), []);

    return { isDark, toggle };
}

/** Call this once at app startup (before React renders) to prevent flash of light mode */
export function initTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const theme = (stored === 'dark' || stored === 'light') ? stored : 'light';
    applyTheme(theme as 'light' | 'dark');
}
