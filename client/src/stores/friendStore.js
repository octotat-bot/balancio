import { create } from 'zustand';
import api from '../services/api';

export const useFriendStore = create((set, get) => ({
    friends: {
        accepted: [],
        pendingReceived: [],
        pendingSent: []
    },
    messages: [],
    selectedFriend: null,
    isLoading: false,
    error: null,
    unreadCount: 0,

    fetchFriends: async ({ silent = false } = {}) => {
        if (!silent) set({ isLoading: true, error: null });
        try {
            const response = await api.get('/friends');
            set({
                friends: {
                    accepted: response.data.accepted || [],
                    pendingReceived: response.data.pendingReceived || [],
                    pendingSent: response.data.pendingSent || []
                },
                isLoading: false
            });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch friends';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    addFriend: async (name, phone) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post('/friends/add', { name, phone });
            await get().fetchFriends();
            set({ isLoading: false });
            return { success: true, friendship: response.data.friendship };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to add friend';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    acceptFriend: async (friendshipId) => {
        set({ isLoading: true, error: null });
        try {
            await api.post(`/friends/${friendshipId}/accept`);
            await get().fetchFriends();
            set({ isLoading: false });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to accept friend request';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    rejectFriend: async (friendshipId) => {
        set({ isLoading: true, error: null });
        try {
            await api.post(`/friends/${friendshipId}/reject`);
            await get().fetchFriends();
            set({ isLoading: false });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to reject friend request';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    removeFriend: async (friendshipId) => {
        set({ isLoading: true, error: null });
        try {
            await api.delete(`/friends/${friendshipId}`);
            await get().fetchFriends();
            set({ isLoading: false });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to remove friend';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    getPendingRequests: async () => {
        try {
            const response = await api.get('/friends/pending');
            return { success: true, requests: response.data.pendingRequests, count: response.data.count };
        } catch (error) {
            return { success: false };
        }
    },

    setSelectedFriend: (friend) => {
        set({ selectedFriend: friend, messages: [] });
    },

    fetchMessages: async (friendshipId) => {
        try {
            const response = await api.get(`/friends/${friendshipId}/messages`);
            set({ messages: response.data.messages || [] });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch messages';
            return { success: false, message };
        }
    },

    sendMessage: async (friendshipId, content) => {
        try {
            const response = await api.post(`/friends/${friendshipId}/messages`, { content });
            set(state => ({
                messages: [...state.messages, response.data.message]
            }));
            return { success: true, message: response.data.message };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to send message';
            return { success: false, message };
        }
    },

    getUnreadCount: async () => {
        try {
            const response = await api.get('/friends/unread');
            set({ unreadCount: response.data.unreadCount });
            return response.data.unreadCount;
        } catch (error) {
            return 0;
        }
    },

    clearSelectedFriend: () => {
        set({ selectedFriend: null, messages: [] });
    },

    createLinkedGroup: async (friendshipId) => {
        set({ isLoading: true });
        try {
            const response = await api.post(`/friends/${friendshipId}/create-group`);
            await get().fetchFriends();
            set({ isLoading: false });
            return { success: true, groupId: response.data.groupId };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to create expense group';
            set({ isLoading: false });
            return { success: false, message };
        }
    },

    directExpenses: [],
    directBalance: 0,
    directDetails: { youOwe: 0, theyOwe: 0 },

    addDirectExpense: async (friendshipId, expenseData) => {
        set({ isLoading: true });
        try {
            const response = await api.post(`/friends/${friendshipId}/expenses`, expenseData);
            await get().fetchDirectExpenses(friendshipId);
            await get().fetchDirectBalance(friendshipId);
            set({ isLoading: false });
            return { success: true, expense: response.data.expense };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to add expense';
            set({ isLoading: false });
            return { success: false, message };
        }
    },

    fetchDirectExpenses: async (friendshipId) => {
        try {
            const response = await api.get(`/friends/${friendshipId}/expenses`);
            set({ directExpenses: response.data.expenses || [] });
            return { success: true };
        } catch (error) {
            return { success: false };
        }
    },

    fetchDirectBalance: async (friendshipId) => {
        try {
            const response = await api.get(`/friends/${friendshipId}/direct-balance`);
            set({
                directBalance: response.data.balance || 0,
                directDetails: {
                    youOwe: response.data.youOwe || 0,
                    theyOwe: response.data.theyOwe || 0
                }
            });
            return { success: true, balance: response.data.balance };
        } catch (error) {
            return { success: false };
        }
    },

    deleteDirectExpense: async (friendshipId, expenseId) => {
        set({ isLoading: true });
        try {
            await api.delete(`/friends/${friendshipId}/expenses/${expenseId}`);
            await get().fetchDirectExpenses(friendshipId);
            await get().fetchDirectBalance(friendshipId);
            set({ isLoading: false });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to delete expense';
            set({ isLoading: false });
            return { success: false, message };
        }
    },

    settleUp: async (friendshipId, amount = null) => {
        set({ isLoading: true });
        try {
            const data = amount ? { amount } : {};
            await api.post(`/friends/${friendshipId}/settle`, data);
            await get().fetchDirectExpenses(friendshipId);
            await get().fetchDirectBalance(friendshipId);
            set({ isLoading: false });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to settle up';
            set({ isLoading: false });
            return { success: false, message };
        }
    },

    pendingSettlements: [],

    createSettlement: async (friendshipId, amount, note = '', isReceiverMarking = false) => {
        set({ isLoading: true });
        try {
            await api.post(`/friends/${friendshipId}/settlements`, { amount, note, isReceiverMarking });
            await get().fetchSettlements(friendshipId);
            await get().fetchDirectBalance(friendshipId);
            set({ isLoading: false });
            return { success: true, message: isReceiverMarking ? 'Payment marked as received!' : 'Payment sent! Awaiting confirmation.' };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to send payment';
            set({ isLoading: false });
            return { success: false, message };
        }
    },

    fetchSettlements: async (friendshipId) => {
        try {
            const response = await api.get(`/friends/${friendshipId}/settlements`);
            set({ pendingSettlements: response.data.pending || [] });
            return response.data;
        } catch (error) {
            return { pending: [], confirmed: [] };
        }
    },

    confirmSettlement: async (friendshipId, settlementId) => {
        set({ isLoading: true });
        try {
            await api.post(`/friends/${friendshipId}/settlements/${settlementId}/confirm`);
            await get().fetchSettlements(friendshipId);
            await get().fetchDirectBalance(friendshipId);
            await get().fetchDirectExpenses(friendshipId);
            set({ isLoading: false });
            return { success: true, message: 'Payment confirmed!' };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to confirm payment';
            set({ isLoading: false });
            return { success: false, message };
        }
    },

    rejectSettlement: async (friendshipId, settlementId) => {
        set({ isLoading: true });
        try {
            await api.delete(`/friends/${friendshipId}/settlements/${settlementId}`);
            await get().fetchSettlements(friendshipId);
            set({ isLoading: false });
            return { success: true, message: 'Payment rejected' };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to reject payment';
            set({ isLoading: false });
            return { success: false, message };
        }
    },

    clearError: () => {
        set({ error: null });
    }
}));

export default useFriendStore;
