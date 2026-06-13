import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { FIRST_VISIT_KEY } from '../hooks/useFirstVisit';
import { AUTH_STORAGE_KEY, clearAuthStorage } from '../utils/authStorage';

export { AUTH_STORAGE_KEY, clearAuthStorage } from '../utils/authStorage';

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

                    localStorage.setItem(FIRST_VISIT_KEY, '1');

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
                clearAuthStorage();
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
                    clearAuthStorage();
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
            name: AUTH_STORAGE_KEY,
            storage: {
                getItem: (name) => {
                    const str = sessionStorage.getItem(name);
                    if (str) return JSON.parse(str);
                    const legacy = localStorage.getItem(name);
                    if (legacy) {
                        sessionStorage.setItem(name, legacy);
                        localStorage.removeItem(name);
                        return JSON.parse(legacy);
                    }
                    return null;
                },
                setItem: (name, value) => {
                    sessionStorage.setItem(name, JSON.stringify(value));
                    localStorage.removeItem(name);
                },
                removeItem: (name) => {
                    sessionStorage.removeItem(name);
                    localStorage.removeItem(name);
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
