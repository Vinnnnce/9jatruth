import apiClient from './client';
import type { LoginResponse, RefreshTokenResponse, User } from './types';

export const authApi = {
  login: (email: string, password: string): Promise<LoginResponse> =>
    apiClient.post('/auth/login', { email, password }),

  logout: (): Promise<void> =>
    apiClient.post('/auth/logout'),

  refreshToken: (): Promise<RefreshTokenResponse> => {
    const refreshToken = localStorage.getItem('refreshToken');
    return apiClient.post('/auth/refresh', { refreshToken });
  },

  getMe: (): Promise<User> =>
    apiClient.get('/auth/me'),

  updateProfile: (data: Partial<User>): Promise<User> =>
    apiClient.put('/auth/profile', data),

  changePassword: (currentPassword: string, newPassword: string): Promise<void> =>
    apiClient.put('/auth/password', { currentPassword, newPassword }),
};
