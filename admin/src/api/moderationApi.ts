import apiClient from './client';
import type { Report, FactCheck, PaginatedResponse, PaginationParams } from './types';

export const moderationApi = {
  // Reports
  getReports: (params?: PaginationParams & { status?: string; targetType?: string }): Promise<PaginatedResponse<Report>> =>
    apiClient.get('/moderation/reports', { params }),

  getReport: (id: string): Promise<Report> =>
    apiClient.get(`/moderation/reports/${id}`),

  resolveReport: (id: string, data: { resolution: string; action: 'RESOLVE' | 'DISMISS' }): Promise<Report> =>
    apiClient.put(`/moderation/reports/${id}/resolve`, data),

  // Fact Checks
  getFactChecks: (params?: PaginationParams): Promise<PaginatedResponse<FactCheck>> =>
    apiClient.get('/moderation/fact-checks', { params }),

  getFactCheck: (id: string): Promise<FactCheck> =>
    apiClient.get(`/moderation/fact-checks/${id}`),

  createFactCheck: (data: Partial<FactCheck>): Promise<FactCheck> =>
    apiClient.post('/moderation/fact-checks', data),

  updateFactCheck: (id: string, data: Partial<FactCheck>): Promise<FactCheck> =>
    apiClient.put(`/moderation/fact-checks/${id}`, data),

  deleteFactCheck: (id: string): Promise<void> =>
    apiClient.delete(`/moderation/fact-checks/${id}`),
};
