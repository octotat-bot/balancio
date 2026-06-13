import { create } from 'zustand';
import api from '../services/api';

export const useSettlementStore = create((set, get) => ({
    settlements: [],
    balances: [],
    simplifiedDebts: [],
    detailedDebts: [],
    isSimplified: false,
    activeGroupId: null,
    isLoading: false,
    error: null,

    fetchSettlements: async (groupId, { silent = false } = {}) => {
        if (!silent) set({ isLoading: true, error: null });
        try {
            const response = await api.get(`/settlements/${groupId}/settlements`);
            set({ settlements: response.data.settlements, activeGroupId: groupId, isLoading: false });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch settlements';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    fetchBalances: async (groupId, simplify = null, { silent = false } = {}) => {
        if (!silent) set({ isLoading: true, error: null });
        const shouldSimplify = simplify !== null ? simplify : get().isSimplified;

        try {
            const response = await api.get(`/settlements/${groupId}/balances?simplify=${shouldSimplify}`);
            set({
                balances: response.data.balances,
                simplifiedDebts: response.data.simplifiedDebts,
                detailedDebts: response.data.detailedDebts || [],
                isSimplified: shouldSimplify,
                activeGroupId: groupId,
                isLoading: false
            });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch balances';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    toggleSimplify: (groupId) => {
        const current = get().isSimplified;
        get().fetchBalances(groupId, !current);
    },

    createSettlement: async (groupId, settlementData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post(`/settlements/${groupId}/settlements`, settlementData);
            const newSettlement = response.data.settlement;
            set((state) => ({
                settlements: [newSettlement, ...state.settlements],
                isLoading: false,
            }));
            return { success: true, settlement: newSettlement, message: response.data.message };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to create settlement';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    confirmSettlement: async (groupId, settlementId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.put(`/settlements/${groupId}/settlements/${settlementId}/confirm`);
            const updatedSettlement = response.data.settlement;
            set((state) => ({
                settlements: state.settlements.map((s) =>
                    s._id === settlementId ? updatedSettlement : s
                ),
                isLoading: false,
            }));
            return { success: true, settlement: updatedSettlement };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to confirm settlement';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    deleteSettlement: async (groupId, settlementId) => {
        set({ isLoading: true, error: null });
        try {
            await api.delete(`/settlements/${groupId}/settlements/${settlementId}`);
            set((state) => ({
                settlements: state.settlements.filter((s) => s._id !== settlementId),
                isLoading: false,
            }));
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to delete settlement';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    clearSettlements: () => {
        set({
            settlements: [],
            balances: [],
            simplifiedDebts: [],
            detailedDebts: [],
            isSimplified: false,
            activeGroupId: null,
            error: null,
        });
    },

    clearError: () => {
        set({ error: null });
    },
}));

export default useSettlementStore;
