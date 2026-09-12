import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  return dayjs(date).format('DD MMM YYYY');
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  return dayjs(date).format('DD MMM YYYY, HH:mm');
}

export function formatTimeAgo(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  return dayjs(date).fromNow();
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString('en-NG');
}

export function formatCompactNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(1)}%`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getTruthScoreColor(score: number | undefined): 'success' | 'warning' | 'error' | 'default' {
  if (score === undefined || score === null) return 'default';
  if (score >= 75) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

export function getTruthScoreLabel(score: number | undefined): string {
  if (score === undefined || score === null) return 'Unverified';
  if (score >= 75) return 'High Trust';
  if (score >= 50) return 'Medium Trust';
  if (score >= 25) return 'Low Trust';
  return 'Very Low Trust';
}
