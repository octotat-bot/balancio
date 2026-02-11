import { create } from 'zustand';
import api from '../services/api';

const useSettlementNotificationStore = create((set, get) => ({
    pendingFriendSettlements: [],
    pendingGroupSettlements: [],
    pendingFriendRequests: [],
    activeNotifications: [],
    notifiedIds: new Set(),

    fetchAllPendingItems: async () => {
        try {
            const authData = sessionStorage.getItem('auth-storage');
            let userId = null;

            if (authData) {
                try {
                    const parsed = JSON.parse(authData);
                    userId = parsed?.state?.user?._id;
                } catch (e) {
                    return;
                }
            }

            if (!userId) {
                return;
            }

            let friendsData = { accepted: [], pendingReceived: [], pendingSent: [] };
            try {
                const friendsResponse = await api.get('/friends');
                friendsData = friendsResponse.data || {};
            } catch (e) {
                // Skip
            }

            const pendingRequests = (friendsData.pendingReceived || []).map(fr => ({
                ...fr,
                notificationType: 'friendRequest',
                _id: fr._id
            }));

            let allFriendSettlements = [];
            const friends = friendsData.accepted || [];

            for (const friend of friends) {
                try {
                    const response = await api.get(`/friends/${friend._id}/settlements`);
                    const pending = (response.data?.pending || []).map(s => ({
                        ...s,
                        friendshipId: friend._id,
                        friendName: friend.name,
                        notificationType: 'friendSettlement'
                    }));
                    allFriendSettlements = [...allFriendSettlements, ...pending];
                } catch (e) {
                    // Skip
                }
            }

            let allGroupSettlements = [];
            try {
                const groupsResponse = await api.get('/groups');
                const groupsData = groupsResponse.data;
                const groups = Array.isArray(groupsData) ? groupsData : (groupsData?.groups || []);

                for (const group of groups) {
                    try {
                        const response = await api.get(`/settlements/${group._id}/settlements`);
                        const settlements = response.data?.settlements || response.data || [];
                        const pending = settlements
                            .filter(s => !s.confirmedByRecipient && s.to?._id === userId)
                            .map(s => ({
                                ...s,
                                groupId: group._id,
                                groupName: group.name,
                                notificationType: 'groupSettlement'
                            }));
                        allGroupSettlements = [...allGroupSettlements, ...pending];
                    } catch (e) {
                        // Skip
                    }
                }
            } catch (e) {
                // Skip
            }

            set({
                pendingFriendRequests: pendingRequests,
                pendingFriendSettlements: allFriendSettlements,
                pendingGroupSettlements: allGroupSettlements
            });

            get().checkForNewNotifications(pendingRequests, allFriendSettlements, allGroupSettlements, userId);

        } catch (error) {
            // Skip
        }
    },

    checkForNewNotifications: (friendRequests, friendSettlements, groupSettlements, userId) => {
        const { notifiedIds, activeNotifications } = get();

        if (!userId) return;

        const newNotifications = [];
        const newNotifiedIds = new Set(notifiedIds);

        friendRequests.forEach(fr => {
            const frId = `fr-${fr._id}`;
            if (!notifiedIds.has(frId)) {
                newNotifications.push({
                    ...fr,
                    notificationId: `${frId}-${Date.now()}`,
                    notificationType: 'friendRequest'
                });
                newNotifiedIds.add(frId);
            }
        });

        friendSettlements.forEach(s => {
            const isReceiver = s.to?._id === userId || s.to === userId;
            const fsId = `fs-${s._id}`;
            if (isReceiver && !notifiedIds.has(fsId)) {
                newNotifications.push({
                    ...s,
                    notificationId: `${fsId}-${Date.now()}`,
                    notificationType: 'friendSettlement'
                });
                newNotifiedIds.add(fsId);
            }
        });

        groupSettlements.forEach(s => {
            const isReceiver = s.to?._id === userId || s.to === userId;
            const gsId = `gs-${s._id}`;
            if (isReceiver && !notifiedIds.has(gsId)) {
                newNotifications.push({
                    ...s,
                    notificationId: `${gsId}-${Date.now()}`,
                    notificationType: 'groupSettlement'
                });
                newNotifiedIds.add(gsId);
            }
        });

        if (newNotifications.length > 0) {
            set({
                activeNotifications: [...activeNotifications, ...newNotifications],
                notifiedIds: newNotifiedIds
            });
        }
    },

    addRealtimeNotification: (type, data) => {
        const allowedTypes = ['friendRequest', 'friendSettlement', 'groupSettlement'];

        if (!allowedTypes.includes(type)) {
            return;
        }

        const { activeNotifications, notifiedIds } = get();

        let uniqueId;
        if (type === 'friendRequest') uniqueId = `fr-${data._id}`;
        else if (type === 'friendSettlement') uniqueId = `fs-${data._id}`;
        else if (type === 'groupSettlement') uniqueId = `gs-${data._id}`;
        else uniqueId = `n-${data._id || Date.now()}`;

        if (notifiedIds.has(uniqueId)) {
            return;
        }

        const notification = {
            ...data,
            notificationId: `${uniqueId}-${Date.now()}`,
            notificationType: type
        };

        const newNotifiedIds = new Set(notifiedIds);
        newNotifiedIds.add(uniqueId);

        set({
            activeNotifications: [...activeNotifications, notification],
            notifiedIds: newNotifiedIds
        });
    },

    dismissNotification: (notificationId) => {
        set(state => ({
            activeNotifications: state.activeNotifications.filter(n => n.notificationId !== notificationId)
        }));
    },

    acceptFriendRequest: async (friendshipId) => {
        try {
            await api.post(`/friends/${friendshipId}/accept`);

            set(state => ({
                pendingFriendRequests: state.pendingFriendRequests.filter(f => f._id !== friendshipId),
                activeNotifications: state.activeNotifications.filter(n => n._id !== friendshipId)
            }));

            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Failed to accept' };
        }
    },

    rejectFriendRequest: async (friendshipId) => {
        try {
            await api.post(`/friends/${friendshipId}/reject`);

            set(state => ({
                pendingFriendRequests: state.pendingFriendRequests.filter(f => f._id !== friendshipId),
                activeNotifications: state.activeNotifications.filter(n => n._id !== friendshipId)
            }));

            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Failed to reject' };
        }
    },

    confirmFriendSettlement: async (friendshipId, settlementId) => {
        try {
            await api.post(`/friends/${friendshipId}/settlements/${settlementId}/confirm`);

            set(state => ({
                pendingFriendSettlements: state.pendingFriendSettlements.filter(s => s._id !== settlementId),
                activeNotifications: state.activeNotifications.filter(n => n._id !== settlementId)
            }));

            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Failed to confirm' };
        }
    },

    rejectFriendSettlement: async (friendshipId, settlementId) => {
        try {
            await api.delete(`/friends/${friendshipId}/settlements/${settlementId}`);

            set(state => ({
                pendingFriendSettlements: state.pendingFriendSettlements.filter(s => s._id !== settlementId),
                activeNotifications: state.activeNotifications.filter(n => n._id !== settlementId)
            }));

            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Failed to reject' };
        }
    },

    confirmGroupSettlement: async (groupId, settlementId) => {
        try {
            await api.put(`/settlements/${groupId}/settlements/${settlementId}/confirm`);

            set(state => ({
                pendingGroupSettlements: state.pendingGroupSettlements.filter(s => s._id !== settlementId),
                activeNotifications: state.activeNotifications.filter(n => n._id !== settlementId)
            }));

            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Failed to confirm' };
        }
    },

    rejectGroupSettlement: async (groupId, settlementId) => {
        try {
            await api.delete(`/settlements/${groupId}/settlements/${settlementId}`);

            set(state => ({
                pendingGroupSettlements: state.pendingGroupSettlements.filter(s => s._id !== settlementId),
                activeNotifications: state.activeNotifications.filter(n => n._id !== settlementId)
            }));

            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Failed to reject' };
        }
    },

    clearAll: () => {
        set({ activeNotifications: [] });
    }
}));

export default useSettlementNotificationStore;
