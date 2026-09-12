import apiClient from './client';
import type { State, Lga, Ward, Community, PaginatedResponse, PaginationParams } from './types';

export const geoApi = {
  // States
  getStates: (params?: PaginationParams): Promise<PaginatedResponse<State>> =>
    apiClient.get('/geo/states', { params }),

  getState: (id: string): Promise<State> =>
    apiClient.get(`/geo/states/${id}`),

  createState: (data: Partial<State>): Promise<State> =>
    apiClient.post('/geo/states', data),

  updateState: (id: string, data: Partial<State>): Promise<State> =>
    apiClient.put(`/geo/states/${id}`, data),

  deleteState: (id: string): Promise<void> =>
    apiClient.delete(`/geo/states/${id}`),

  // LGAs
  getLgas: (params?: PaginationParams): Promise<PaginatedResponse<Lga>> =>
    apiClient.get('/geo/lgas', { params }),

  getLga: (id: string): Promise<Lga> =>
    apiClient.get(`/geo/lgas/${id}`),

  createLga: (data: Partial<Lga>): Promise<Lga> =>
    apiClient.post('/geo/lgas', data),

  updateLga: (id: string, data: Partial<Lga>): Promise<Lga> =>
    apiClient.put(`/geo/lgas/${id}`, data),

  deleteLga: (id: string): Promise<void> =>
    apiClient.delete(`/geo/lgas/${id}`),

  // Wards
  getWards: (params?: PaginationParams): Promise<PaginatedResponse<Ward>> =>
    apiClient.get('/geo/wards', { params }),

  getWard: (id: string): Promise<Ward> =>
    apiClient.get(`/geo/wards/${id}`),

  createWard: (data: Partial<Ward>): Promise<Ward> =>
    apiClient.post('/geo/wards', data),

  updateWard: (id: string, data: Partial<Ward>): Promise<Ward> =>
    apiClient.put(`/geo/wards/${id}`, data),

  deleteWard: (id: string): Promise<void> =>
    apiClient.delete(`/geo/wards/${id}`),

  // Communities
  getCommunities: (params?: PaginationParams): Promise<PaginatedResponse<Community>> =>
    apiClient.get('/geo/communities', { params }),

  getCommunity: (id: string): Promise<Community> =>
    apiClient.get(`/geo/communities/${id}`),

  createCommunity: (data: Partial<Community>): Promise<Community> =>
    apiClient.post('/geo/communities', data),

  updateCommunity: (id: string, data: Partial<Community>): Promise<Community> =>
    apiClient.put(`/geo/communities/${id}`, data),

  deleteCommunity: (id: string): Promise<void> =>
    apiClient.delete(`/geo/communities/${id}`),

  // Bulk operations
  importGeoData: (file: File, type: 'states' | 'lgas' | 'wards' | 'communities'): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/geo/import/${type}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
