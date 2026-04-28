import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const r = exceptionResponse as Record<string, unknown>;
        message = (r.message as string | string[]) ?? message;
        errorCode = (r.errorCode as string) ?? mapStatusToCode(status);
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    // Never leak internal details on 5xx in production
    if (status >= 500 && process.env.NODE_ENV === 'production') {
      message = 'Internal server error';
    }

    response.status(status).json({
      success: false,
      error: {
        code: errorCode,
        message,
        statusCode: status,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

function mapStatusToCode(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_ERROR',
    503: 'SERVICE_UNAVAILABLE',
  };
  return map[status] ?? 'ERROR';
}
