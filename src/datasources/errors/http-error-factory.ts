import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { HttpExceptionPayload } from './interfaces/http-exception-payload.interface';

/**
 * Creates an HttpException from an http error response coming from another service.
 * If an error response it's received, it gets parsed, and the status code is kept.
 * Otherwise, a default error data with 503 http status code is returned.
 */
@Injectable()
export class HttpErrorFactory {
  private readonly logger = new Logger(HttpErrorFactory.name);

  private mapError(err: AxiosError | Error): HttpExceptionPayload {
    if (axios.isAxiosError(err) && err.response) {
      const axiosError = err as AxiosError;
      const errData = axiosError?.response?.data as HttpExceptionPayload;
      return <HttpExceptionPayload>{
        message: errData.message,
        code: axiosError.response?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        arguments: errData.arguments,
      };
    } else {
      return <HttpExceptionPayload>{
        message: 'Service unavailable',
        code: HttpStatus.SERVICE_UNAVAILABLE,
      };
    }
  }

  from(err: AxiosError | Error): HttpException {
    const errPayload = this.mapError(err);
    this.logger.error(errPayload);
    return new HttpException(errPayload, errPayload.code);
  }
}
