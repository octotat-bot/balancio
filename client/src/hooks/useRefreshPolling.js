import { useEffect, useRef } from 'react';

/**
 * Poll on an interval when the tab is visible.
 * Does not run on mount by default — pages should load once in their own useEffect.
 */
export function useRefreshPolling(
    callback,
    intervalMs = 60000,
    enabled = true,
    { runOnMount = false, refreshOnVisible = true, minHiddenBeforeRefreshMs = 60000 } = {}
) {
    const savedCallback = useRef(callback);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) return undefined;

        const run = () => {
            if (document.visibilityState !== 'visible') return;
            savedCallback.current();
        };

        if (runOnMount) run();

        const id = setInterval(run, intervalMs);

        let hiddenAt = null;
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                hiddenAt = Date.now();
                return;
            }
            if (!refreshOnVisible || hiddenAt === null) return;
            const awayMs = Date.now() - hiddenAt;
            hiddenAt = null;
            if (awayMs >= minHiddenBeforeRefreshMs) run();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [intervalMs, enabled, runOnMount, refreshOnVisible, minHiddenBeforeRefreshMs]);
}
