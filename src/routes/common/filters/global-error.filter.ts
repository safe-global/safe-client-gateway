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
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';

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
    const isHttpExceptionNoLog = exception instanceof HttpExceptionNoLog;

    const httpStatus =
      isHttpException || isHttpExceptionNoLog
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpExceptionNoLog) {
      this.log({
        exception,
        httpStatus,
      });
    }

    const responseBody =
      isHttpException || isHttpExceptionNoLog
        ? exception.getResponse()
        : {
            code: httpStatus,
            message: 'Internal server error',
          };
    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }

  private log(args: { exception: Error; httpStatus: number }): void {
    const logMessage = {
      name: args.exception.name,
      message: args.exception.message,
      stacktrace: args.exception.stack,
    };

    const isServerError = args.httpStatus >= 500 && args.httpStatus < 600;
    if (isServerError) {
      this.loggingService.error(logMessage);
    } else {
      this.loggingService.info(logMessage);
    }
  }
}
