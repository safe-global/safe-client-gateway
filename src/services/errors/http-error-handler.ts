import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { HttpExceptionPayload } from './interfaces/http-exception-payload.interface';

/**
 * Handles an http error response coming from another service.
 * If an error response it's received, it gets parsed, and the status code is kept.
 * Otherwise, a default error data with 503 http status code is returned.
 */
@Injectable()
export class HttpErrorHandler {
  private readonly logger = new Logger(HttpErrorHandler.name);

  private mapError(err: AxiosError | Error): HttpExceptionPayload {
    if (axios.isAxiosError(err) && err.response) {
      const axiosError = err as AxiosError;
      const errData = axiosError.response.data as HttpExceptionPayload;
      return <HttpExceptionPayload>{
        message: errData.message,
        code: axiosError.response.status,
        arguments: errData.arguments,
      };
    } else {
      return <HttpExceptionPayload>{
        message: err.message || 'Service unavailable',
        code: HttpStatus.SERVICE_UNAVAILABLE,
      };
    }
  }

  handle(err: AxiosError | Error) {
    const errPayload = this.mapError(err);
    this.logger.error(errPayload);
    throw new HttpException(errPayload, errPayload.code);
  }
}
