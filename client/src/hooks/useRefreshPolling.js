import { useEffect, useRef } from 'react';

/** Poll a callback on an interval — used when Socket.io is unavailable (e.g. Vercel). */
export function useRefreshPolling(callback, intervalMs = 30000, enabled = true) {
    const savedCallback = useRef(callback);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) return undefined;

        savedCallback.current();
        const id = setInterval(() => savedCallback.current(), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs, enabled]);
}
