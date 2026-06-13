export const AUTH_STORAGE_KEY = 'auth-storage';

/** Clears auth from both storages (session + legacy localStorage). */
export function clearAuthStorage() {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
}
