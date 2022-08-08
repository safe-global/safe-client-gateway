import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { BaseError } from './interfaces/base-error.interface';
import { HttpServiceErrorResponseData } from './interfaces/http-service-error-response.interface';

/**
 * Handles an http error response coming from another service.
 * If an error response it's received, it gets parsed, and the status code is kept.
 * Otherwise, a default error data with 503 http status code is returned.
 */
@Injectable()
export class HttpErrorHandler {
  private mapError(err: AxiosError | Error): BaseError {
    if (axios.isAxiosError(err) && err.response) {
      const axiosError = err as AxiosError;
      const errData = axiosError.response.data as HttpServiceErrorResponseData;
      return <BaseError>{
        message: errData.message,
        statusCode: axiosError.response.status,
        arguments: errData.arguments,
      };
    } else {
      return <BaseError>{
        message: 'Service unavailable',
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      };
    }
  }

  handle(err: AxiosError | Error) {
    const error = this.mapError(err);
    throw new HttpException(error, error.statusCode);
  }
}
