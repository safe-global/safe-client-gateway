// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Injectable } from '@nestjs/common';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';

interface FastApiValidationError {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

/**
 * Maps FastAPI-style errors from the queue service into {@link DataSourceError}.
 *
 * FastAPI returns errors in two forms:
 * - `{ detail: "message" }` for simple errors
 * - `{ detail: [{ loc, msg, type }] }` for validation errors
 */
@Injectable()
export class QueueServiceErrorMapper {
  from(source: unknown): DataSourceError {
    if (source instanceof NetworkResponseError) {
      const message = this.extractMessage(source.data);
      return new DataSourceError(message, source.response.status);
    }
    return new DataSourceError(
      'Queue service unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private extractMessage(data: unknown): string {
    if (data === null || data === undefined) {
      return 'An error occurred';
    }

    if (typeof data !== 'object') {
      return 'An error occurred';
    }

    const detail = (data as Record<string, unknown>).detail;

    if (typeof detail === 'string') {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((err: FastApiValidationError) => {
          const location = err.loc?.join(' -> ') ?? 'unknown';
          return `${location}: ${err.msg}`;
        })
        .join('; ');
    }

    return 'An error occurred';
  }
}
