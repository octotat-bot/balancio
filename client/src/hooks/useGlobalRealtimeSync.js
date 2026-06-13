import { useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useGroupStore } from '../stores/groupStore';
import { useFriendStore } from '../stores/friendStore';
import { useNotificationStore } from '../stores/notificationStore';
import useSettlementNotificationStore from '../stores/settlementNotificationStore';
import { useRefreshPolling } from './useRefreshPolling';
import { REALTIME_POLL_FAST_MS, REALTIME_POLL_SLOW_MS, GLOBAL_SYNC_EVENT } from '../constants/realtime';

/**
 * Keeps groups, friends, notifications, and pending settlements in sync
 * without manual refresh. Uses fast polling when Socket.io is unavailable.
 */
export function useGlobalRealtimeSync() {
    const user = useAuthStore((s) => s.user);
    const isConnected = useChatStore((s) => s.isConnected);
    const fetchGroups = useGroupStore((s) => s.fetchGroups);
    const fetchFriends = useFriendStore((s) => s.fetchFriends);
    const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
    const fetchAllPendingItems = useSettlementNotificationStore((s) => s.fetchAllPendingItems);

    const sync = useCallback(async () => {
        if (!user?._id) return;

        await Promise.allSettled([
            fetchGroups({ silent: true }),
            fetchFriends({ silent: true }),
            fetchUnreadCount(),
            fetchAllPendingItems(),
        ]);

        window.dispatchEvent(new CustomEvent(GLOBAL_SYNC_EVENT));
    }, [user?._id, fetchGroups, fetchFriends, fetchUnreadCount, fetchAllPendingItems]);

    useRefreshPolling(
        sync,
        isConnected ? REALTIME_POLL_SLOW_MS : REALTIME_POLL_FAST_MS,
        Boolean(user?._id)
    );
}

export default useGlobalRealtimeSync;
