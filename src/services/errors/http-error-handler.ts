import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { HttpExceptionPayload } from './interfaces/http-exception-payload.interface';

/**
 * Handles an http error response coming from another service.
 * If an error response it's received, it gets parsed, and the status code is kept.
 * Otherwise, a default error data with 503 http status code is returned.
 */
@Injectable()
export class HttpErrorHandler {
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
        message: 'Service unavailable',
        code: HttpStatus.SERVICE_UNAVAILABLE,
      };
    }
  }

  handle(err: AxiosError | Error) {
    const error = this.mapError(err);
    throw new HttpException(error, error.code);
  }
}
