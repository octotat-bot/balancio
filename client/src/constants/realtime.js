/** Background poll when WebSocket is unavailable (e.g. Vercel serverless). */
export const REALTIME_POLL_FAST_MS = 60000;

/** Backup poll when WebSocket is connected (local dev). */
export const REALTIME_POLL_SLOW_MS = 120000;

/** Poll active views (chat, open friend thread) a bit more often. */
export const REALTIME_POLL_ACTIVE_MS = 30000;

export const GLOBAL_SYNC_EVENT = 'app:global-sync';
