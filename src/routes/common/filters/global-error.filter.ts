import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { HttpAdapterHost } from '@nestjs/core';
import { HttpExceptionWithLog } from '@/domain/common/errors/http-exception-with-log.errors';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  catch(exception: Error, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    const isHttpException = exception instanceof HttpException;
    const isHttpExceptionWithLog = exception instanceof HttpExceptionWithLog;

    const httpStatus =
      isHttpException || isHttpExceptionWithLog
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpExceptionWithLog || exception.log) {
      const logMessage = {
        name: exception.name,
        message: exception.message,
        stacktrace: exception.stack,
      };
      if (httpStatus >= 500 && httpStatus < 600) {
        this.loggingService.error(logMessage);
      } else {
        this.loggingService.info(logMessage);
      }
    }

    const responseBody =
      isHttpException || isHttpExceptionWithLog
        ? exception.getResponse()
        : {
            code: httpStatus,
            message: 'Internal server error',
          };
    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
