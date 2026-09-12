import type {
  UserRole,
  PostStatus,
  CommentStatus,
  ReportStatus,
  FactCheckVerdict,
  ElectionStatus,
  ElectionType,
  NewsStatus,
  OfficeLevel,
} from '@api/types';

export const ROLES: Record<UserRole, { label: string; color: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'error' },
  ADMIN: { label: 'Admin', color: 'primary' },
  MODERATOR: { label: 'Moderator', color: 'warning' },
  ANALYST: { label: 'Analyst', color: 'info' },
  EDITOR: { label: 'Editor', color: 'secondary' },
};

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MODERATOR', label: 'Moderator' },
  { value: 'ANALYST', label: 'Analyst' },
  { value: 'EDITOR', label: 'Editor' },
];

export const POST_STATUSES: Record<PostStatus, { label: string; color: 'success' | 'warning' | 'error' | 'default' | 'info' }> = {
  PUBLISHED: { label: 'Published', color: 'success' },
  PENDING: { label: 'Pending', color: 'warning' },
  FLAGGED: { label: 'Flagged', color: 'error' },
  REMOVED: { label: 'Removed', color: 'default' },
  ARCHIVED: { label: 'Archived', color: 'info' },
};

export const COMMENT_STATUSES: Record<CommentStatus, { label: string; color: 'success' | 'warning' | 'error' | 'default' | 'info' }> = {
  PUBLISHED: { label: 'Published', color: 'success' },
  PENDING: { label: 'Pending', color: 'warning' },
  FLAGGED: { label: 'Flagged', color: 'error' },
  REMOVED: { label: 'Removed', color: 'default' },
};

export const REPORT_STATUSES: Record<ReportStatus, { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  PENDING: { label: 'Pending', color: 'warning' },
  RESOLVED: { label: 'Resolved', color: 'success' },
  DISMISSED: { label: 'Dismissed', color: 'default' },
};

export const FACT_CHECK_VERDICTS: Record<FactCheckVerdict, { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  TRUE: { label: 'True', color: 'success' },
  MOSTLY_TRUE: { label: 'Mostly True', color: 'success' },
  MIXED: { label: 'Mixed', color: 'warning' },
  MOSTLY_FALSE: { label: 'Mostly False', color: 'error' },
  FALSE: { label: 'False', color: 'error' },
  UNVERIFIED: { label: 'Unverified', color: 'info' },
};

export const ELECTION_STATUSES: Record<ElectionStatus, { label: string; color: 'success' | 'warning' | 'error' | 'default' | 'info' }> = {
  UPCOMING: { label: 'Upcoming', color: 'info' },
  ONGOING: { label: 'Ongoing', color: 'warning' },
  COMPLETED: { label: 'Completed', color: 'success' },
  CANCELLED: { label: 'Cancelled', color: 'error' },
};

export const ELECTION_TYPES: Record<ElectionType, string> = {
  PRESIDENTIAL: 'Presidential',
  GUBERNATORIAL: 'Gubernatorial',
  PARLIAMENTARY: 'Parliamentary',
  LOCAL_GOVERNMENT: 'Local Government',
  BY_ELECTION: 'By-Election',
};

export const NEWS_STATUSES: Record<NewsStatus, { label: string; color: 'success' | 'warning' | 'default' | 'info' }> = {
  DRAFT: { label: 'Draft', color: 'warning' },
  PUBLISHED: { label: 'Published', color: 'success' },
  ARCHIVED: { label: 'Archived', color: 'default' },
};

export const OFFICE_LEVELS: Record<OfficeLevel, string> = {
  FEDERAL: 'Federal',
  STATE: 'State',
  LOCAL: 'Local',
};

export const POST_CATEGORIES = [
  'Politics',
  'Governance',
  'Elections',
  'Security',
  'Economy',
  'Education',
  'Health',
  'Infrastructure',
  'Social Issues',
  'Environment',
  'Other',
];

export const NEWS_CATEGORIES = [
  'Breaking',
  'Politics',
  'Elections',
  'Security',
  'Economy',
  'Sports',
  'Entertainment',
  'Health',
  'Education',
  'World',
  'Opinion',
];

export const REPORT_REASONS = [
  'Misinformation',
  'Hate Speech',
  'Harassment',
  'Spam',
  'Violence',
  'Adult Content',
  'Impersonation',
  'Other',
];

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

export const NIGERIAN_REGIONS = ['North Central', 'North East', 'North West', 'South East', 'South South', 'South West'];

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
