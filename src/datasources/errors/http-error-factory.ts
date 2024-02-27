import { HttpStatus, Injectable } from '@nestjs/common';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { get } from 'lodash';

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
    if (source instanceof NetworkResponseError) {
      const errorMessage = this.getNetworkResponseErrorMessage(source);
      return new DataSourceError(errorMessage, source.response.status);
    } else {
      return new DataSourceError(
        'Service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private getNetworkResponseErrorMessage(source: NetworkResponseError): string {
    return (
      get(source, 'data.nonFieldErrors[0]') || // Django error
      get(source, 'data.message') ||
      get(source, 'response.statusText') ||
      'An error occurred'
    );
  }
}
