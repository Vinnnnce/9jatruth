import apiClient from './client';
import type { Party, Candidate, Office, Election, PaginatedResponse, PaginationParams } from './types';

export const politicsApi = {
  // Parties
  getParties: (params?: PaginationParams): Promise<PaginatedResponse<Party>> =>
    apiClient.get('/politics/parties', { params }),

  getParty: (id: string): Promise<Party> =>
    apiClient.get(`/politics/parties/${id}`),

  createParty: (data: Partial<Party>): Promise<Party> =>
    apiClient.post('/politics/parties', data),

  updateParty: (id: string, data: Partial<Party>): Promise<Party> =>
    apiClient.put(`/politics/parties/${id}`, data),

  deleteParty: (id: string): Promise<void> =>
    apiClient.delete(`/politics/parties/${id}`),

  // Candidates
  getCandidates: (params?: PaginationParams): Promise<PaginatedResponse<Candidate>> =>
    apiClient.get('/politics/candidates', { params }),

  getCandidate: (id: string): Promise<Candidate> =>
    apiClient.get(`/politics/candidates/${id}`),

  createCandidate: (data: Partial<Candidate>): Promise<Candidate> =>
    apiClient.post('/politics/candidates', data),

  updateCandidate: (id: string, data: Partial<Candidate>): Promise<Candidate> =>
    apiClient.put(`/politics/candidates/${id}`, data),

  deleteCandidate: (id: string): Promise<void> =>
    apiClient.delete(`/politics/candidates/${id}`),

  // Offices
  getOffices: (params?: PaginationParams): Promise<PaginatedResponse<Office>> =>
    apiClient.get('/politics/offices', { params }),

  getOffice: (id: string): Promise<Office> =>
    apiClient.get(`/politics/offices/${id}`),

  createOffice: (data: Partial<Office>): Promise<Office> =>
    apiClient.post('/politics/offices', data),

  updateOffice: (id: string, data: Partial<Office>): Promise<Office> =>
    apiClient.put(`/politics/offices/${id}`, data),

  deleteOffice: (id: string): Promise<void> =>
    apiClient.delete(`/politics/offices/${id}`),

  // Elections
  getElections: (params?: PaginationParams): Promise<PaginatedResponse<Election>> =>
    apiClient.get('/politics/elections', { params }),

  getElection: (id: string): Promise<Election> =>
    apiClient.get(`/politics/elections/${id}`),

  createElection: (data: Partial<Election>): Promise<Election> =>
    apiClient.post('/politics/elections', data),

  updateElection: (id: string, data: Partial<Election>): Promise<Election> =>
    apiClient.put(`/politics/elections/${id}`, data),

  deleteElection: (id: string): Promise<void> =>
    apiClient.delete(`/politics/elections/${id}`),
};
