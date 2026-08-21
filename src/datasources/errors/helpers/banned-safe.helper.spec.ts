// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { errorStatusCodeExcluding } from '@/__tests__/faker';
import {
  UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE,
  UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
} from '@/datasources/errors/constants';
import {
  isBannedSafeError,
  mapBannedSafeError,
} from '@/datasources/errors/helpers/banned-safe.helper';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';

describe('mapBannedSafeError', () => {
  it('replaces the payload of a banned-Safe response with a client-facing message', () => {
    const error = new NetworkResponseError(
      new URL(faker.internet.url()),
      new Response(null, {
        status: UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
      }),
      // The Transaction Service reports the reason under `detail`, a key
      // HttpErrorFactory does not read; the text itself is discarded
      { detail: faker.word.words() },
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
    const error = new NetworkResponseError(
      new URL(faker.internet.url()),
      new Response(null, {
        status: errorStatusCodeExcluding(UNAVAILABLE_FOR_LEGAL_REASONS_STATUS),
      }),
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
      new Response(null, {
        status: UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
      }),
      { detail: faker.word.words() },
    );

    const actual = new HttpErrorFactory().from(mapBannedSafeError(error));

    expect(actual.code).toBe(UNAVAILABLE_FOR_LEGAL_REASONS_STATUS);
    expect(actual.message).toBe(UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE);
  });

  it('identifies a banned-Safe response by status alone, whatever the payload', () => {
    const withDetail = new NetworkResponseError(
      new URL(faker.internet.url()),
      new Response(null, { status: UNAVAILABLE_FOR_LEGAL_REASONS_STATUS }),
      { detail: faker.word.words() },
    );
    // A payload shape the Transaction Service does not currently send for 451
    const withNonFieldErrors = new NetworkResponseError(
      new URL(faker.internet.url()),
      new Response(null, { status: UNAVAILABLE_FOR_LEGAL_REASONS_STATUS }),
      { nonFieldErrors: [faker.word.words()] },
    );

    expect(isBannedSafeError(withDetail)).toBe(true);
    expect(isBannedSafeError(withNonFieldErrors)).toBe(true);
    expect(
      isBannedSafeError(
        new NetworkResponseError(
          new URL(faker.internet.url()),
          new Response(null, {
            status: errorStatusCodeExcluding(
              UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
            ),
          }),
        ),
      ),
    ).toBe(false);
    expect(isBannedSafeError(new Error(faker.word.words()))).toBe(false);
  });
});
