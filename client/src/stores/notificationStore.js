import { create } from 'zustand';
import api from '../services/api';

export const useNotificationStore = create((set) => ({
    unreadCount: 0,

    fetchUnreadCount: async () => {
        try {
            const res = await api.get('/notifications');
            set({ unreadCount: res.data.unreadCount ?? res.data.count ?? 0 });
        } catch {
            set({ unreadCount: 0 });
        }
    },
}));

export default useNotificationStore;
