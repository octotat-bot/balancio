/** Fast poll when WebSocket is unavailable (e.g. Vercel serverless). */
export const REALTIME_POLL_FAST_MS = 8000;

/** Slow backup poll when WebSocket is connected (local dev). */
export const REALTIME_POLL_SLOW_MS = 45000;

export const GLOBAL_SYNC_EVENT = 'app:global-sync';
