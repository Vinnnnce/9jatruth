import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../dto/api-response.dto';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        // If already wrapped in ApiResponse, return as-is
        if (data instanceof ApiResponse) {
          return data;
        }

        // If the response is null/undefined, return success with null data
        if (data === null || data === undefined) {
          return ApiResponse.success(null);
        }

        // Check if data has pagination meta (from prisma pagination util)
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'meta' in data
        ) {
          const { data: items, meta } = data as {
            data: unknown;
            meta: {
              page: number;
              limit: number;
              total: number;
              totalPages: number;
            };
          };
          return ApiResponse.success(items, meta);
        }

        return ApiResponse.success(data);
      }),
    );
  }
}
