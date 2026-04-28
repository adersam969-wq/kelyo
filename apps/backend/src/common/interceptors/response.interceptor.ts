import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Allow controllers to return already-shaped { data, meta }
        if (data && typeof data === 'object' && 'data' in data && !Array.isArray(data)) {
          const d = data as { data: T; meta?: Record<string, unknown> };
          return { success: true, data: d.data, meta: d.meta };
        }
        return { success: true, data };
      }),
    );
  }
}
