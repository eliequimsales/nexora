import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { PlanLimitException } from '../exceptions/plan-limit.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof PlanLimitException) {
      response.status(402).json({
        statusCode: 402,
        error: 'PAYMENT_REQUIRED',
        message: exception.message,
        code: 'plan_limit_exceeded',
        resource: exception.resource,
      });
      return;
    }

    const { statusCode, error, message } = this.resolve(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({ statusCode, error, message });
  }

  private resolve(exception: unknown): {
    statusCode: number;
    error: string;
    message: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'object' && 'message' in res
          ? Array.isArray((res as { message: unknown }).message)
            ? ((res as { message: string[] }).message).join('; ')
            : String((res as { message: unknown }).message)
          : exception.message;

      return { statusCode: status, error: this.statusToError(status), message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { statusCode: 409, error: 'CONFLICT', message: 'Resource already exists' };
      }
      if (exception.code === 'P2025') {
        return { statusCode: 404, error: 'NOT_FOUND', message: 'Resource not found' };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  private statusToError(status: number): string {
    const map: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      402: 'PAYMENT_REQUIRED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return map[status] ?? 'ERROR';
  }
}
