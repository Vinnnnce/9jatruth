import apiClient from './client';
import type { DashboardStats, PostsByStateData, UserGrowthData, TruthScoreDistribution } from './types';

export const statsApi = {
  getDashboardStats: (): Promise<DashboardStats> =>
    apiClient.get('/stats/dashboard'),

  getPostsByState: (): Promise<PostsByStateData[]> =>
    apiClient.get('/stats/posts-by-state'),

  getUserGrowth: (days = 30): Promise<UserGrowthData[]> =>
    apiClient.get('/stats/user-growth', { params: { days } }),

  getTruthScoreDistribution: (): Promise<TruthScoreDistribution[]> =>
    apiClient.get('/stats/truth-score-distribution'),

  getTopReportedPosts: (limit = 10): Promise<any[]> =>
    apiClient.get('/stats/top-reported-posts', { params: { limit } }),
};
