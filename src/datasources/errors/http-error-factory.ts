import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSourceError } from '../../domain/errors/data-source.error';
import {
  NetworkError,
  NetworkResponseError,
} from '../network/entities/network.error.entity';

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
  from(source: NetworkError | Error): DataSourceError {
    if (isNetworkResponseError(source)) {
      const errorMessage: string = source.data?.message ?? 'An error occurred';
      return new DataSourceError(errorMessage, source.status);
    } else {
      return new DataSourceError(
        'Service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}

function isNetworkResponseError(
  error: NetworkError | Error,
): error is NetworkResponseError {
  const responseError = error as NetworkResponseError;
  return responseError.status >= 400 && responseError.status < 600;
}
