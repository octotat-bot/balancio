import { create } from 'zustand';
import api from '../services/api';

export const useExpenseStore = create((set, get) => ({
    expenses: [],
    currentExpense: null,
    isLoading: false,
    error: null,

    fetchExpenses: async (groupId, { silent = false } = {}) => {
        if (!silent) set({ isLoading: true, error: null });
        try {
            const response = await api.get(`/groups/${groupId}/expenses`);
            set({ expenses: response.data.expenses, isLoading: false });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch expenses';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    createExpense: async (groupId, expenseData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post(`/groups/${groupId}/expenses`, expenseData);
            const newExpense = response.data.expense;
            const warning = response.data.warning;
            set((state) => ({
                expenses: [newExpense, ...state.expenses],
                isLoading: false,
            }));
            return { success: true, expense: newExpense, warning };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to create expense';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    updateExpense: async (groupId, expenseId, expenseData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.put(`/groups/${groupId}/expenses/${expenseId}`, expenseData);
            const updatedExpense = response.data.expense;
            set((state) => ({
                expenses: state.expenses.map((e) => (e._id === expenseId ? updatedExpense : e)),
                isLoading: false,
            }));
            return { success: true, expense: updatedExpense };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to update expense';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    deleteExpense: async (groupId, expenseId) => {
        set({ isLoading: true, error: null });
        try {
            await api.delete(`/groups/${groupId}/expenses/${expenseId}`);
            set((state) => ({
                expenses: state.expenses.filter((e) => e._id !== expenseId),
                isLoading: false,
            }));
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to delete expense';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    clearExpenses: () => {
        set({ expenses: [], currentExpense: null });
    },

    clearError: () => {
        set({ error: null });
    },
}));

export default useExpenseStore;
