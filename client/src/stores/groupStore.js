import { create } from 'zustand';
import api from '../services/api';

export const useGroupStore = create((set, get) => ({
    groups: [],
    currentGroup: null,
    isLoading: false,
    error: null,

    fetchGroups: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get('/groups');
            set({ groups: response.data.groups, isLoading: false });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch groups';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    fetchGroup: async (groupId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get(`/groups/${groupId}`);
            set({ currentGroup: response.data.group, isLoading: false });
            return { success: true, group: response.data.group };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch group';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    createGroup: async (groupData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post('/groups', groupData);
            const newGroup = response.data.group;
            set((state) => ({
                groups: [...state.groups, newGroup],
                isLoading: false,
            }));
            return { success: true, group: newGroup };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to create group';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    updateGroup: async (groupId, groupData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.put(`/groups/${groupId}`, groupData);
            const updatedGroup = response.data.group;
            set((state) => ({
                groups: state.groups.map((g) => (g._id === groupId ? updatedGroup : g)),
                currentGroup: state.currentGroup?._id === groupId ? updatedGroup : state.currentGroup,
                isLoading: false,
            }));
            return { success: true, group: updatedGroup };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to update group';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    deleteGroup: async (groupId) => {
        set({ isLoading: true, error: null });
        try {
            await api.delete(`/groups/${groupId}`);
            set((state) => ({
                groups: state.groups.filter((g) => g._id !== groupId),
                currentGroup: state.currentGroup?._id === groupId ? null : state.currentGroup,
                isLoading: false,
            }));
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to delete group';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    addGroup: (group) => {
        set((state) => {
            if (state.groups.some(g => g._id === group._id)) return state;
            return { groups: [group, ...state.groups] };
        });
    },

    removeGroupFromList: (groupId) => {
        set((state) => ({
            groups: state.groups.filter(g => g._id !== groupId),
            currentGroup: state.currentGroup?._id === groupId ? null : state.currentGroup,
        }));
    },

    addMember: async (groupId, memberData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post(`/groups/${groupId}/members`, memberData);
            const updatedGroup = response.data.group;
            set((state) => ({
                currentGroup: updatedGroup,
                groups: state.groups.map((g) => (g._id === groupId ? updatedGroup : g)),
                isLoading: false,
            }));
            return { success: true, message: response.data.message };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to add member';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    removeMember: async (groupId, memberId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.delete(`/groups/${groupId}/members/${memberId}`);
            const updatedGroup = response.data.group;
            set((state) => ({
                currentGroup: updatedGroup,
                groups: state.groups.map((g) => (g._id === groupId ? updatedGroup : g)),
                isLoading: false,
            }));
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to remove member';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    removePendingMember: async (groupId, pendingMemberId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.delete(`/groups/${groupId}/pending-members/${pendingMemberId}`);
            const updatedGroup = response.data.group;
            set((state) => ({
                currentGroup: updatedGroup,
                groups: state.groups.map((g) => (g._id === groupId ? updatedGroup : g)),
                isLoading: false,
            }));
            return { success: true, message: response.data.message };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to remove pending member';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    promoteToAdmin: async (groupId, memberId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.put(`/groups/${groupId}/members/${memberId}/promote`);
            const updatedGroup = response.data.group;
            set((state) => ({
                currentGroup: updatedGroup,
                groups: state.groups.map((g) => (g._id === groupId ? updatedGroup : g)),
                isLoading: false,
            }));
            return { success: true, message: response.data.message };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to promote member';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    downloadReport: async (groupId, groupName) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get(`/groups/${groupId}/export`, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = `balncio_expenses_${groupName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();

            set({ isLoading: false });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to download report';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    updateBudgets: async (groupId, budgets) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.put(`/groups/${groupId}/budgets`, { budgets });
            const updatedGroup = response.data.group;
            set((state) => ({
                currentGroup: updatedGroup,
                groups: state.groups.map((g) => (g._id === groupId ? updatedGroup : g)),
                isLoading: false,
            }));
            return { success: true, message: 'Budgets updated' };
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to update budgets';
            set({ isLoading: false, error: message });
            return { success: false, message };
        }
    },

    clearCurrentGroup: () => {
        set({ currentGroup: null });
    },

    clearError: () => {
        set({ error: null });
    },
}));

export default useGroupStore;
