import apiClient from './client';
import type { Party, Candidate, Office, Election, PaginatedResponse, PaginationParams } from './types';

export const politicsApi = {
  // Parties
  getParties: (params?: PaginationParams): Promise<PaginatedResponse<Party>> =>
    apiClient.get('/parties', { params }),

  getParty: (id: string): Promise<Party> =>
    apiClient.get(`/parties/${id}`),

  createParty: (data: Partial<Party>): Promise<Party> =>
    apiClient.post('/parties', data),

  updateParty: (id: string, data: Partial<Party>): Promise<Party> =>
    apiClient.put(`/parties/${id}`, data),

  deleteParty: (id: string): Promise<void> =>
    apiClient.delete(`/parties/${id}`),

  // Candidates
  getCandidates: (params?: PaginationParams): Promise<PaginatedResponse<Candidate>> =>
    apiClient.get('/candidates', { params }),

  getCandidate: (id: string): Promise<Candidate> =>
    apiClient.get(`/candidates/${id}`),

  createCandidate: (data: Partial<Candidate>): Promise<Candidate> =>
    apiClient.post('/candidates', data),

  updateCandidate: (id: string, data: Partial<Candidate>): Promise<Candidate> =>
    apiClient.put(`/candidates/${id}`, data),

  deleteCandidate: (id: string): Promise<void> =>
    apiClient.delete(`/candidates/${id}`),

  // Offices
  getOffices: (params?: PaginationParams): Promise<PaginatedResponse<Office>> =>
    apiClient.get('/offices', { params }),

  getOffice: (id: string): Promise<Office> =>
    apiClient.get(`/offices/${id}`),

  createOffice: (data: Partial<Office>): Promise<Office> =>
    apiClient.post('/offices', data),

  updateOffice: (id: string, data: Partial<Office>): Promise<Office> =>
    apiClient.put(`/offices/${id}`, data),

  deleteOffice: (id: string): Promise<void> =>
    apiClient.delete(`/offices/${id}`),

  // Elections
  getElections: (params?: PaginationParams): Promise<PaginatedResponse<Election>> =>
    apiClient.get('/elections', { params }),

  getElection: (id: string): Promise<Election> =>
    apiClient.get(`/elections/${id}`),

  createElection: (data: Partial<Election>): Promise<Election> =>
    apiClient.post('/elections', data),

  updateElection: (id: string, data: Partial<Election>): Promise<Election> =>
    apiClient.put(`/elections/${id}`, data),

  deleteElection: (id: string): Promise<void> =>
    apiClient.delete(`/elections/${id}`),
};
