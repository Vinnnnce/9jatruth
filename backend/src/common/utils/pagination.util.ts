import { PaginationDto } from '../dto/pagination.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function buildPaginationWhere(
  baseWhere: Record<string, unknown>,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return { ...baseWhere, ...(extra || {}) };
}

export function buildPaginationOrderBy(
  pagination: PaginationDto,
  defaultField = 'createdAt',
): Record<string, string> {
  const field = pagination.sortBy || defaultField;
  const order = pagination.sortOrder || 'desc';
  return { [field]: order };
}

export function buildPaginationArgs(pagination: PaginationDto) {
  return {
    skip: pagination.skip,
    take: pagination.take,
  };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  pagination: PaginationDto,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}
