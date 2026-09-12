import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track refresh state
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - attach auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor - handle errors, auto-refresh token
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });
        const { token, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', newRefreshToken);
        processQueue(null, token);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 403 - forbidden
    if (error.response?.status === 403) {
      const message = (error.response.data as { message?: string })?.message || 'Access denied';
      return Promise.reject(new Error(message));
    }

    // 404 - not found
    if (error.response?.status === 404) {
      return Promise.reject(new Error('Resource not found'));
    }

    // 500 - server error
    if (error.response?.status && error.response.status >= 500) {
      return Promise.reject(new Error('Server error. Please try again later.'));
    }

    // Network error
    if (!error.response) {
      return Promise.reject(new Error('Network error. Please check your connection.'));
    }

    // Extract error message
    const errorMessage =
      (error.response.data as { message?: string })?.message ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject(new Error(errorMessage));
  }
);

export default apiClient;
