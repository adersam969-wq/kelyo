export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    [key: string]: unknown;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string | string[];
    statusCode: number;
    path?: string;
    timestamp: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
