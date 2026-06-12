import axios from 'axios';

const getStoredToken = () => {
    try {
        const raw = sessionStorage.getItem('auth-storage');
        if (!raw) return null;
        return JSON.parse(raw)?.state?.token ?? null;
    } catch {
        return null;
    }
};

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'https://balancio-backend-six.vercel.app/api',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

api.interceptors.request.use(
    (config) => {
        const token = getStoredToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.data?.message) {
            error.message = error.response.data.message;
        }

        if (error.response) {
            switch (error.response.status) {
                case 401:
                    if (!window.location.pathname.includes('/auth')) {
                        sessionStorage.removeItem('auth-storage');
                        window.location.href = '/auth';
                    }
                    break;
                case 403:
                case 404:
                case 500:
                default:
                    break;
            }
        } else if (error.code === 'ECONNABORTED') {
            error.message = 'Request timed out. Please try again.';
        } else if (!navigator.onLine) {
            error.message = 'No internet connection. Please check your network.';
        }

        return Promise.reject(error);
    }
);

export default api;
