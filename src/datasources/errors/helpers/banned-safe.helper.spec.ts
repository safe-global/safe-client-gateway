// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE,
  UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
} from '@/datasources/errors/constants';
import { mapBannedSafeError } from '@/datasources/errors/helpers/banned-safe.helper';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';

describe('mapBannedSafeError', () => {
  it('replaces the payload of a banned-Safe response with a client-facing message', () => {
    const error = new NetworkResponseError(
      new URL(faker.internet.url()),
      {
        status: UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
      } as Response,
      // The Transaction Service reports the reason under `detail`
      { detail: 'Safe is unavailable for legal reasons' },
    );

    const actual = mapBannedSafeError(error);

    expect(actual).toBeInstanceOf(NetworkResponseError);
    expect(actual).toMatchObject({
      url: error.url,
      response: error.response,
      data: { message: UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE },
    });
  });

  it('returns a response error of any other status untouched', () => {
    let statusCode: number;
    do {
      statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
    } while (statusCode === UNAVAILABLE_FOR_LEGAL_REASONS_STATUS);
    const error = new NetworkResponseError(
      new URL(faker.internet.url()),
      { status: statusCode } as Response,
      { message: faker.word.words() },
    );

    expect(mapBannedSafeError(error)).toBe(error);
  });

  it('returns a request error untouched', () => {
    const error = new NetworkRequestError(new URL(faker.internet.url()));

    expect(mapBannedSafeError(error)).toBe(error);
  });

  it('returns an arbitrary error untouched', () => {
    const error = new Error(faker.word.words());

    expect(mapBannedSafeError(error)).toBe(error);
  });

  it('yields a 451 DataSourceError once funneled through HttpErrorFactory', () => {
    const error = new NetworkResponseError(
      new URL(faker.internet.url()),
      {
        status: UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
      } as Response,
      { detail: 'Safe is unavailable for legal reasons' },
    );

    const actual = new HttpErrorFactory().from(mapBannedSafeError(error));

    expect(actual.code).toBe(UNAVAILABLE_FOR_LEGAL_REASONS_STATUS);
    expect(actual.message).toBe(UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE);
  });
});
