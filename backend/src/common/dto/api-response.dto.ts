import { ApiProperty } from '@nestjs/swagger';

export class ApiResponse<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ description: 'Response data' })
  data: T;

  @ApiProperty({
    description: 'Pagination metadata',
    required: false,
    example: {
      page: 1,
      limit: 20,
      total: 100,
      totalPages: 5,
    },
  })
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  constructor(success: boolean, data: T, meta?: ApiResponse<T>['meta']) {
    this.success = success;
    this.data = data;
    this.meta = meta;
  }

  static success<T>(data: T, meta?: ApiResponse<T>['meta']): ApiResponse<T> {
    return new ApiResponse(true, data, meta);
  }

  static error<T>(data: T): ApiResponse<T> {
    return new ApiResponse(false, data);
  }
}
