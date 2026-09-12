import apiClient from './client';
import type { DashboardStats, PostsByStateData, UserGrowthData, TruthScoreDistribution } from './types';

export const statsApi = {
  getDashboardStats: (): Promise<DashboardStats> =>
    apiClient.get('/admin/stats'),

  getPostsByState: (): Promise<PostsByStateData[]> =>
    apiClient.get('/admin/stats/posts-by-state'),

  getUserGrowth: (days = 30): Promise<UserGrowthData[]> =>
    apiClient.get('/admin/stats/user-growth', { params: { days } }),

  getTruthScoreDistribution: (): Promise<TruthScoreDistribution[]> =>
    apiClient.get('/admin/stats/truth-score-distribution'),

  getTopReportedPosts: (limit = 10): Promise<any[]> =>
    apiClient.get('/admin/stats/top-reported-posts', { params: { limit } }),
};
