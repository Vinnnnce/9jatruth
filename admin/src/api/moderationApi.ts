import apiClient from './client';
import type { Report, FactCheck, PaginatedResponse, PaginationParams } from './types';

export const moderationApi = {
  // Reports
  getReports: (params?: PaginationParams & { status?: string; targetType?: string }): Promise<PaginatedResponse<Report>> =>
    apiClient.get('/admin/reports', { params }),

  getReport: (id: string): Promise<Report> =>
    apiClient.get(`/admin/reports/${id}`),

  resolveReport: (id: string, data: { status: string; resolution?: string }): Promise<Report> =>
    apiClient.put(`/admin/reports/${id}`, data),

  // Fact Checks
  getFactChecks: (params?: PaginationParams): Promise<PaginatedResponse<FactCheck>> =>
    apiClient.get('/admin/fact-checks', { params }),

  getFactCheck: (id: string): Promise<FactCheck> =>
    apiClient.get(`/admin/fact-checks/${id}`),

  createFactCheck: (data: Partial<FactCheck>): Promise<FactCheck> =>
    apiClient.post('/admin/fact-checks', data),

  updateFactCheck: (id: string, data: Partial<FactCheck>): Promise<FactCheck> =>
    apiClient.put(`/admin/fact-checks/${id}`, data),

  deleteFactCheck: (id: string): Promise<void> =>
    apiClient.delete(`/admin/fact-checks/${id}`),
};
