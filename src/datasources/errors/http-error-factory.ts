import { HttpStatus, Injectable } from '@nestjs/common';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { isObject } from 'lodash';

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
  from(source: unknown): DataSourceError {
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

function isNetworkResponseError(error: unknown): error is NetworkResponseError {
  return (
    isObject(error) &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 600
  );
}
