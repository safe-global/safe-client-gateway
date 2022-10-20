import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  NetworkError,
  NetworkResponseError,
} from '../network/entities/network.error.entity';
import { DataSourceError } from '../../domain/errors/data-source.error';

/**
 * Maps a {@link NetworkError} or {@link Error} into a {@link DataSourceError}
 *
 * If the error comes from a response (i.e.: HTTP status code is an error)
 * then the status code is forwarded alongside a message field if available
 * in the body of the response.
 *
 * Otherwise, a default error data with 503 http status code is returned.
 */
@Injectable()
export class HttpErrorFactory {
  private readonly logger = new Logger(HttpErrorFactory.name);

  private mapError(error: NetworkError | Error): DataSourceError {
    if (isNetworkResponseError(error)) {
      const errorMessage: string = error.data?.message ?? 'An error occurred';
      return new DataSourceError(errorMessage, error.status);
    } else {
      return new DataSourceError(
        'Service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  from(source: NetworkError | Error): DataSourceError {
    const error = this.mapError(source);
    this.logger.error(error);
    return error;
  }
}

function isNetworkResponseError(
  error: NetworkError | Error,
): error is NetworkResponseError {
  const responseError = error as NetworkResponseError;
  return responseError.status >= 400 && responseError.status < 600;
}
