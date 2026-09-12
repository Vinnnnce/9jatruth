import apiClient from './client';
import type { User, PaginatedResponse, PaginationParams } from './types';

export const usersApi = {
  getUsers: (params?: PaginationParams): Promise<PaginatedResponse<User>> =>
    apiClient.get('/users', { params }),

  getUser: (id: string): Promise<User> =>
    apiClient.get(`/users/${id}`),

  createUser: (data: Partial<User>): Promise<User> =>
    apiClient.post('/users', data),

  deleteUser: (id: string): Promise<void> =>
    apiClient.delete(`/users/${id}`),
};
