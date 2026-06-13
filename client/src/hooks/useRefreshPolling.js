import { useEffect, useRef } from 'react';

/** Poll on an interval and when the tab becomes visible again. */
export function useRefreshPolling(callback, intervalMs = 8000, enabled = true) {
    const savedCallback = useRef(callback);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) return undefined;

        const run = () => savedCallback.current();

        run();
        const id = setInterval(run, intervalMs);

        const onVisible = () => {
            if (document.visibilityState === 'visible') run();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [intervalMs, enabled]);
}
