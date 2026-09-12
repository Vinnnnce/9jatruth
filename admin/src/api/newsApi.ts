import apiClient from './client';
import type { NewsArticle, PaginatedResponse, PaginationParams } from './types';

export const newsApi = {
  getNews: (params?: PaginationParams & { status?: string; category?: string }): Promise<PaginatedResponse<NewsArticle>> =>
    apiClient.get('/news', { params }),

  getNewsArticle: (id: string): Promise<NewsArticle> =>
    apiClient.get(`/news/${id}`),

  createNews: (data: Partial<NewsArticle>): Promise<NewsArticle> =>
    apiClient.post('/news', data),

  updateNews: (id: string, data: Partial<NewsArticle>): Promise<NewsArticle> =>
    apiClient.put(`/news/${id}`, data),

  deleteNews: (id: string): Promise<void> =>
    apiClient.delete(`/news/${id}`),

  publishNews: (id: string): Promise<NewsArticle> =>
    apiClient.put(`/news/${id}/publish`),

  archiveNews: (id: string): Promise<NewsArticle> =>
    apiClient.put(`/news/${id}/archive`),
};
