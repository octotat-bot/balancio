import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            _hasHydrated: false,

            setHasHydrated: (state) => {
                set({ _hasHydrated: state });
            },

            login: async (identifier, password, type = 'email') => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post('/auth/login', { identifier, password, type });
                    const { user, token } = response.data;

                    set({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                    return { success: true };
                } catch (error) {
                    const message = error.response?.data?.message || 'Login failed';
                    set({ isLoading: false, error: message });
                    return { success: false, message };
                }
            },

            signup: async (userData) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post('/auth/signup', userData);
                    const { user, token } = response.data;

                    set({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                    return {
                        success: true,
                        onboarding: response.data.onboarding,
                        userName: userData.name,
                    };
                } catch (error) {
                    console.error('Auth Store Signup Error:', error);
                    const message = error.response?.data?.message || 'Signup failed';
                    set({ isLoading: false, error: message });
                    return { success: false, message };
                }
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    error: null,
                });
                delete api.defaults.headers.common['Authorization'];
                sessionStorage.removeItem('auth-storage');
            },

            updateUser: async (userData) => {
                set({ isLoading: true });
                try {
                    const response = await api.put('/auth/profile', userData);
                    set((state) => ({
                        user: { ...state.user, ...response.data.user },
                        isLoading: false,
                    }));
                    return { success: true };
                } catch (error) {
                    set({ isLoading: false });
                    return { success: false, message: error.response?.data?.message || 'Update failed' };
                }
            },

            changePassword: async (currentPassword, newPassword) => {
                set({ isLoading: true });
                try {
                    await api.put('/auth/password', { currentPassword, newPassword });
                    set({ isLoading: false });
                    return { success: true };
                } catch (error) {
                    set({ isLoading: false });
                    return { success: false, message: error.response?.data?.message || 'Password change failed' };
                }
            },

            deleteAccount: async () => {
                set({ isLoading: true });
                try {
                    await api.delete('/auth/account');
                    set({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                    delete api.defaults.headers.common['Authorization'];
                    localStorage.removeItem('auth-storage');
                    sessionStorage.removeItem('auth-storage');
                    return { success: true };
                } catch (error) {
                    set({ isLoading: false });
                    return { success: false, message: error.response?.data?.message || 'Failed to delete account' };
                }
            },

            clearError: () => set({ error: null }),

            initAuth: () => {
                const state = get();
                if (state.token) {
                    api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
                }
            },
        }),
        {
            name: 'auth-storage',
            storage: {
                getItem: (name) => {
                    const str = localStorage.getItem(name) || sessionStorage.getItem(name);
                    return str ? JSON.parse(str) : null;
                },
                setItem: (name, value) => {
                    localStorage.setItem(name, JSON.stringify(value));
                    sessionStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name) => {
                    localStorage.removeItem(name);
                    sessionStorage.removeItem(name);
                },
            },
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
            onRehydrateStorage: () => (state) => {
                if (state?.token) {
                    api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
                }
                state?.setHasHydrated(true);
            },
        }
    )
);

export default useAuthStore;
