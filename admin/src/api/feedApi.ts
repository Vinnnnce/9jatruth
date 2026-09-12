import apiClient from './client';
import type { Post, Comment, PaginatedResponse, PaginationParams } from './types';

export const feedApi = {
  // Posts
  getPosts: (params?: PaginationParams & { status?: string; category?: string }): Promise<PaginatedResponse<Post>> =>
    apiClient.get('/feed/posts', { params }),

  getPost: (id: string): Promise<Post> =>
    apiClient.get(`/feed/posts/${id}`),

  deletePost: (id: string): Promise<void> =>
    apiClient.delete(`/feed/posts/${id}`),

  updatePostStatus: (id: string, status: string): Promise<Post> =>
    apiClient.put(`/feed/posts/${id}/status`, { status }),

  // Comments
  getComments: (params?: PaginationParams & { postId?: string; status?: string }): Promise<PaginatedResponse<Comment>> =>
    apiClient.get('/feed/comments', { params }),

  getComment: (id: string): Promise<Comment> =>
    apiClient.get(`/feed/comments/${id}`),

  deleteComment: (id: string): Promise<void> =>
    apiClient.delete(`/feed/comments/${id}`),

  updateCommentStatus: (id: string, status: string): Promise<Comment> =>
    apiClient.put(`/feed/comments/${id}/status`, { status }),
};
