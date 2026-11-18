// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { HttpStatus } from '@nestjs/common';
import { DataSourceError } from '#/domain/errors/data-source.error';
import { getQueueFallbackError } from '#/modules/safe/domain/helpers/queue-fallback-error.helper';

const dataSourceError = (code?: number): DataSourceError =>
  new DataSourceError(faker.lorem.sentence(), code);

describe('getQueueFallbackError', () => {
  it.each([
    HttpStatus.TOO_MANY_REQUESTS,
    HttpStatus.INTERNAL_SERVER_ERROR,
    HttpStatus.BAD_GATEWAY,
    HttpStatus.SERVICE_UNAVAILABLE,
    HttpStatus.GATEWAY_TIMEOUT,
  ])(
    'should return the queue %s when the transaction service answers 404',
    (status) => {
      const queueError = dataSourceError(status);

      const error = getQueueFallbackError({
        queueError,
        txServiceError: dataSourceError(HttpStatus.NOT_FOUND),
      });

      expect(error).toBe(queueError);
    },
  );

  it.each([
    HttpStatus.NOT_FOUND,
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNPROCESSABLE_ENTITY,
  ])(
    'should return the transaction service 404 when the queue answers %s',
    (status) => {
      const txServiceError = dataSourceError(HttpStatus.NOT_FOUND);

      const error = getQueueFallbackError({
        queueError: dataSourceError(status),
        txServiceError,
      });

      expect(error).toBe(txServiceError);
    },
  );

  it('should return the transaction service 404 when the queue failed without a status', () => {
    const txServiceError = dataSourceError(HttpStatus.NOT_FOUND);

    const error = getQueueFallbackError({
      queueError: dataSourceError(),
      txServiceError,
    });

    expect(error).toBe(txServiceError);
  });

  it('should return the transaction service 404 when the queue failed with a non-datasource error', () => {
    const txServiceError = dataSourceError(HttpStatus.NOT_FOUND);

    const error = getQueueFallbackError({
      queueError: new Error(faker.lorem.sentence()),
      txServiceError,
    });

    expect(error).toBe(txServiceError);
  });

  it('should return the transaction service error when it is not a 404', () => {
    const txServiceError = dataSourceError(
      faker.helpers.arrayElement([
        HttpStatus.INTERNAL_SERVER_ERROR,
        HttpStatus.SERVICE_UNAVAILABLE,
      ]),
    );

    const error = getQueueFallbackError({
      queueError: dataSourceError(HttpStatus.TOO_MANY_REQUESTS),
      txServiceError,
    });

    expect(error).toBe(txServiceError);
  });
});
