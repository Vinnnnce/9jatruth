// ===== Auth Types =====
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'ANALYST' | 'EDITOR';

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

// ===== Pagination =====
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

// ===== Geo Types =====
export interface State {
  id: string;
  name: string;
  code: string;
  region: string;
  population?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Lga {
  id: string;
  name: string;
  stateId: string;
  stateName?: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ward {
  id: string;
  name: string;
  lgaId: string;
  lgaName?: string;
  stateId?: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface Community {
  id: string;
  name: string;
  wardId: string;
  wardName?: string;
  lgaId?: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

// ===== Politics Types =====
export interface Party {
  id: string;
  name: string;
  acronym: string;
  logo?: string;
  color?: string;
  foundedYear?: number;
  ideology?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  partyId: string;
  partyName?: string;
  partyAcronym?: string;
  officeId: string;
  officeName?: string;
  stateId?: string;
  stateName?: string;
  photo?: string;
  bio?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Office {
  id: string;
  name: string;
  level: OfficeLevel;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type OfficeLevel = 'FEDERAL' | 'STATE' | 'LOCAL';

export interface Election {
  id: string;
  name: string;
  type: ElectionType;
  date: string;
  status: ElectionStatus;
  description?: string;
  stateId?: string;
  stateName?: string;
  createdAt: string;
  updatedAt: string;
}

export type ElectionType = 'PRESIDENTIAL' | 'GUBERNATORIAL' | 'PARLIAMENTARY' | 'LOCAL_GOVERNMENT' | 'BY_ELECTION';

export type ElectionStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

// ===== Feed Types =====
export interface Post {
  id: string;
  title?: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  stateId?: string;
  stateName?: string;
  category: string;
  truthScore?: number;
  status: PostStatus;
  attachments?: string[];
  commentCount: number;
  likeCount: number;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
}

export type PostStatus = 'PUBLISHED' | 'PENDING' | 'FLAGGED' | 'REMOVED' | 'ARCHIVED';

export interface Comment {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  status: CommentStatus;
  likeCount: number;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
}

export type CommentStatus = 'PUBLISHED' | 'PENDING' | 'FLAGGED' | 'REMOVED';

// ===== Moderation Types =====
export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description?: string;
  status: ReportStatus;
  resolvedById?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReportTargetType = 'POST' | 'COMMENT' | 'USER';
export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

export interface FactCheck {
  id: string;
  postId: string;
  postTitle?: string;
  claim: string;
  verdict: FactCheckVerdict;
  explanation: string;
  sources?: string[];
  checkedById: string;
  checkedByName: string;
  createdAt: string;
  updatedAt: string;
}

export type FactCheckVerdict = 'TRUE' | 'MOSTLY_TRUE' | 'MIXED' | 'MOSTLY_FALSE' | 'FALSE' | 'UNVERIFIED';

// ===== News Types =====
export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  sourceUrl?: string;
  imageUrl?: string;
  category: string;
  stateId?: string;
  stateName?: string;
  status: NewsStatus;
  publishedAt: string;
  authorId?: string;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export type NewsStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

// ===== Stats Types =====
export interface DashboardStats {
  totalUsers: number;
  totalPosts: number;
  activeElections: number;
  pendingReports: number;
  pendingFactChecks: number;
  totalParties: number;
  totalCandidates: number;
  totalNews: number;
}

export interface PostsByStateData {
  state: string;
  count: number;
}

export interface UserGrowthData {
  date: string;
  count: number;
}

export interface TruthScoreDistribution {
  range: string;
  count: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
