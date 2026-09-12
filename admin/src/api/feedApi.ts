import apiClient from './client';
import type { Post, Comment, PaginatedResponse, PaginationParams } from './types';

export const feedApi = {
  // Posts (admin moderation endpoints)
  getPosts: (params?: PaginationParams & { status?: string; category?: string }): Promise<PaginatedResponse<Post>> =>
    apiClient.get('/admin/posts', { params }),

  getPost: (id: string): Promise<Post> =>
    apiClient.get(`/posts/${id}`),

  deletePost: (id: string): Promise<void> =>
    apiClient.delete(`/posts/${id}`),

  updatePostStatus: (id: string, status: string): Promise<Post> =>
    apiClient.put(`/admin/posts/${id}/status`, { status }),

  // Comments (admin moderation endpoints)
  getComments: (params?: PaginationParams & { postId?: string; status?: string }): Promise<PaginatedResponse<Comment>> =>
    apiClient.get('/admin/comments', { params }),

  getComment: (id: string): Promise<Comment> =>
    apiClient.get(`/posts/${id}`),

  deleteComment: (id: string): Promise<void> =>
    apiClient.delete(`/posts/${id}`),

  updateCommentStatus: (id: string, status: string): Promise<Comment> =>
    apiClient.put(`/admin/comments/${id}/status`, { status }),
};
