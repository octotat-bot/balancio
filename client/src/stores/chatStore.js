import { create } from 'zustand';
import { io } from 'socket.io-client';
import api from '../services/api';
import useGroupStore from './groupStore';
import useExpenseStore from './expenseStore';
import useSettlementStore from './settlementStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'https://balancio-backend-six.vercel.app';

const getSocketUrl = () => {
    const url = SOCKET_URL;
    return url.replace(/\/api$/, '');
};

export const useChatStore = create((set, get) => ({
    messages: [],
    socket: null,
    isConnected: false,
    isLoading: false,
    error: null,
    typingUsers: {},
    _connectionFailed: false, // Track if socket.io is unavailable (e.g. Vercel serverless)

    connect: () => {
        if (get().socket || get()._connectionFailed) return;

        const socket = io(getSocketUrl(), {
            transports: ['polling', 'websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 2,  // Reduced: stop quickly if server doesn't support sockets
            reconnectionDelay: 3000,
            timeout: 8000,
        });

        socket.on('connect', () => {
            set({ isConnected: true, _connectionFailed: false });
        });

        socket.on('disconnect', () => {
            set({ isConnected: false });
        });

        // If server doesn't support socket.io (e.g. Vercel serverless), stop retrying
        socket.on('connect_error', (err) => {
            const isServerUnavailable = err?.message?.includes('xhr poll error') ||
                err?.message?.includes('websocket error') ||
                err?.description?.toString().includes('404');

            if (isServerUnavailable) {
                console.warn('Socket.io: server unavailable (serverless environment). Real-time features disabled.');
                socket.disconnect();
                set({ socket: null, isConnected: false, _connectionFailed: true });
            }
        });

        socket.on('receive_message', (message) => {
            set((state) => {
                if (state.messages.some(m => m._id === message._id)) return state;
                return { messages: [message, ...state.messages] };
            });
        });

        socket.on('receive_nudge', ({ toUserId, fromUserName }) => {
            window.dispatchEvent(new CustomEvent('app:nudge', {
                detail: { toUserId, fromUserName }
            }));
        });

        socket.on('user_typing', ({ userId, userName, isTyping }) => {
            set((state) => {
                const newTyping = { ...state.typingUsers };
                if (isTyping) {
                    newTyping[userId] = { userName, isTyping };
                } else {
                    delete newTyping[userId];
                }
                return { typingUsers: newTyping };
            });
        });

        socket.on('group_added', (group) => {
            useGroupStore.getState().addGroup(group);
        });

        socket.on('expense_added', (expense) => {
            const groupId = typeof expense.group === 'object' ? expense.group._id : expense.group;
            useExpenseStore.getState().fetchExpenses(groupId);
            useSettlementStore.getState().fetchBalances(groupId);
            useGroupStore.getState().fetchGroups();
        });

        socket.on('expense_updated', (expense) => {
            const groupId = typeof expense.group === 'object' ? expense.group._id : expense.group;
            useExpenseStore.getState().fetchExpenses(groupId);
            useSettlementStore.getState().fetchBalances(groupId);
            useGroupStore.getState().fetchGroups();
        });

        socket.on('expense_deleted', (expenseId) => {
            const currentGroup = useGroupStore.getState().currentGroup;
            if (currentGroup) {
                useExpenseStore.getState().fetchExpenses(currentGroup._id);
                useSettlementStore.getState().fetchBalances(currentGroup._id);
                useGroupStore.getState().fetchGroups();
            }
        });

        socket.on('settlement_added', (settlement) => {
            const groupId = typeof settlement.group === 'object' ? settlement.group._id : settlement.group;
            useSettlementStore.getState().fetchSettlements(groupId);
            useSettlementStore.getState().fetchBalances(groupId);
            useGroupStore.getState().fetchGroups();
        });

        socket.on('settlement_confirmed', (settlement) => {
            const groupId = typeof settlement.group === 'object' ? settlement.group._id : settlement.group;
            useSettlementStore.getState().fetchSettlements(groupId);
            useSettlementStore.getState().fetchBalances(groupId);
            useGroupStore.getState().fetchGroups();
        });

        socket.on('settlement_deleted', (settlementId) => {
            const currentGroup = useGroupStore.getState().currentGroup;
            if (currentGroup) {
                useSettlementStore.getState().fetchSettlements(currentGroup._id);
                useSettlementStore.getState().fetchBalances(currentGroup._id);
                useGroupStore.getState().fetchGroups();
            }
        });

        socket.on('notification', ({ type, data }) => {
            window.dispatchEvent(new CustomEvent('app:notification', {
                detail: { type, data }
            }));

            if (type === 'friendRequest' || type === 'friendAccepted') {
                window.dispatchEvent(new CustomEvent('app:friends-updated'));
            }
            if (type === 'friendExpenseAdded') {
                window.dispatchEvent(new CustomEvent('app:friend-expenses-updated', {
                    detail: { friendshipId: data.friendshipId }
                }));
            }
            if (type === 'friendSettlement') {
                window.dispatchEvent(new CustomEvent('app:friend-settlements-updated', {
                    detail: { friendshipId: data.friendshipId }
                }));
            }
            if (type === 'friendBalanceUpdated') {
                window.dispatchEvent(new CustomEvent('app:friend-balance-updated', {
                    detail: { friendshipId: data.friendshipId }
                }));
            }
        });

        set({ socket });
    },

    disconnect: () => {
        const { socket } = get();
        if (socket) {
            socket.disconnect();
            set({ socket: null, isConnected: false });
        }
    },

    joinGroup: (groupId, userId) => {
        const { socket } = get();
        if (socket && groupId) {
            socket.emit('join_group', { groupId, userId });
            get().fetchMessages(groupId);
        }
    },

    joinUserRoom: (userId) => {
        const { socket } = get();
        if (socket && userId) {
            socket.emit('join_user', { userId });
        }
    },

    leaveGroup: (groupId) => {
        const { socket } = get();
        if (socket) {
            socket.emit('leave_group', { groupId });
        }
        set({ messages: [], typingUsers: {} });
    },

    fetchMessages: async (groupId) => {
        set({ isLoading: true });
        try {
            const response = await api.get(`/messages/group/${groupId}`);
            set({ messages: response.data.messages, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    sendMessage: (groupId, userId, content) => {
        const { socket } = get();
        if (socket) {
            socket.emit('send_message', { groupId, userId, content });
        }
    },

    sendNudge: (groupId, userIdToNudge, fromUserName) => {
        const { socket } = get();
        if (socket) {
            socket.emit('nudge', { groupId, toUserId: userIdToNudge, fromUserName });
        }
    },

    sendTyping: (groupId, userId, userName, isTyping) => {
        const { socket } = get();
        if (socket) {
            socket.emit('typing', { groupId, userId, userName, isTyping });
        }
    }
}));
