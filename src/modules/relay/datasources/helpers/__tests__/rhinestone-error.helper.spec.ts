// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';
import {
  formatRhinestoneError,
  MAX_LOGGED_UPSTREAM_ERRORS,
  MAX_LOGGED_UPSTREAM_MESSAGE_LENGTH,
} from '@/modules/relay/datasources/helpers/rhinestone-error.helper';

describe('formatRhinestoneError', () => {
  const responseError = (data?: unknown): NetworkResponseError => {
    const status = faker.internet.httpStatusCode({ types: ['clientError'] });
    const statusText = faker.lorem.words();
    return new NetworkResponseError(
      new URL(faker.internet.url()),
      { status, statusText } as Response,
      data,
    );
  };

  const statusPrefix = (error: NetworkResponseError): string =>
    `status=${error.response.status} ${error.response.statusText}`;

  it('should report the status when the body carries nothing loggable', () => {
    const error = responseError({ message: faker.lorem.sentence() });

    expect(formatRhinestoneError(error)).toBe(statusPrefix(error));
  });

  it('should report the status when there is no body at all', () => {
    const error = responseError();

    expect(formatRhinestoneError(error)).toBe(statusPrefix(error));
  });

  it('should append the provider message and traceId', () => {
    const message = faker.lorem.sentence();
    const traceId = faker.string.hexadecimal({ length: 32, prefix: '' });
    const error = responseError({ errors: [{ message }], traceId });

    expect(formatRhinestoneError(error)).toBe(
      `${statusPrefix(error)} upstreamErrors="${message}" traceId=${traceId}`,
    );
  });

  it('should omit the context of a provider error', () => {
    const message = faker.lorem.sentence();
    const contextAddress = getAddress(faker.finance.ethereumAddress());
    const error = responseError({
      errors: [
        {
          message,
          context: {
            chainId: faker.number.int(),
            address: contextAddress,
          },
        },
      ],
    });

    // Asserting the whole string: `context` is absent, not merely unasserted.
    expect(formatRhinestoneError(error)).toBe(
      `${statusPrefix(error)} upstreamErrors="${message}"`,
    );
  });

  it('should collapse newlines so an upstream message cannot forge a log line', () => {
    const [first, second] = faker.lorem.words(2).split(' ');
    const error = responseError({
      errors: [{ message: `${first}\n${second}` }],
    });

    expect(formatRhinestoneError(error)).toBe(
      `${statusPrefix(error)} upstreamErrors="${first} ${second}"`,
    );
  });

  it('should cap the length of a provider message', () => {
    const overLength = 'a'.repeat(MAX_LOGGED_UPSTREAM_MESSAGE_LENGTH + 1);
    const error = responseError({ errors: [{ message: overLength }] });

    expect(formatRhinestoneError(error)).toBe(
      `${statusPrefix(error)} upstreamErrors="${'a'.repeat(MAX_LOGGED_UPSTREAM_MESSAGE_LENGTH)}…"`,
    );
  });

  it('should not cap a message exactly at the limit', () => {
    const atLimit = 'a'.repeat(MAX_LOGGED_UPSTREAM_MESSAGE_LENGTH);
    const error = responseError({ errors: [{ message: atLimit }] });

    expect(formatRhinestoneError(error)).toBe(
      `${statusPrefix(error)} upstreamErrors="${atLimit}"`,
    );
  });

  it('should cap the number of provider messages', () => {
    const messages = faker.helpers.uniqueArray(
      () => faker.string.alphanumeric({ length: 8 }),
      MAX_LOGGED_UPSTREAM_ERRORS + 2,
    );
    const error = responseError({
      errors: messages.map((message) => ({ message })),
    });

    expect(formatRhinestoneError(error)).toBe(
      `${statusPrefix(error)} upstreamErrors="${messages.slice(0, MAX_LOGGED_UPSTREAM_ERRORS).join('; ')}"`,
    );
  });

  it('should discard blank messages before applying the cap', () => {
    const message = faker.lorem.sentence();
    const blanks = Array.from({ length: MAX_LOGGED_UPSTREAM_ERRORS }, () => ({
      message: ' ',
    }));
    const error = responseError({ errors: [...blanks, { message }] });

    expect(formatRhinestoneError(error)).toBe(
      `${statusPrefix(error)} upstreamErrors="${message}"`,
    );
  });

  it('should report the traceId even when no message is loggable', () => {
    const traceId = faker.string.hexadecimal({ length: 32, prefix: '' });
    const error = responseError({ errors: [], traceId });

    expect(formatRhinestoneError(error)).toBe(
      `${statusPrefix(error)} traceId=${traceId}`,
    );
  });

  it('should report the target URL when no response was received', () => {
    const url = new URL(faker.internet.url());

    expect(formatRhinestoneError(new NetworkRequestError(url))).toBe(
      `no response received from ${url}`,
    );
  });

  it('should fall back to the message of a non-network error', () => {
    const message = faker.lorem.sentence();

    expect(formatRhinestoneError(new Error(message))).toBe(message);
  });
});
