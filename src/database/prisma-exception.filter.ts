import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { Response } from 'express';
import { isTransientDbError } from './is-transient-db-error';

@Catch()
export class PrismaExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  constructor(protected readonly httpAdapterHost: HttpAdapterHost) {
    super(httpAdapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (isTransientDbError(exception)) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();

      this.logger.warn(
        'Mất kết nối DB tạm thời — vui lòng thử lại',
        exception instanceof Error ? exception.message : exception,
      );

      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          'Không thể kết nối cơ sở dữ liệu tạm thời. Vui lòng thử lại sau vài giây.',
      });
      return;
    }

    super.catch(exception, host);
  }
}
