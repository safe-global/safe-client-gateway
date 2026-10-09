// SPDX-License-Identifier: FSL-1.1-MIT

import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { faker } from '@faker-js/faker';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { Hex } from 'viem';
import type { Mock } from '#/__tests__/mocks';
import { SafeTxHashMismatchError } from '#/modules/relay/domain/errors/safe-tx-hash-mismatch.error';
import { SafeTxHashMismatchExceptionFilter } from '#/modules/relay/domain/exception-filters/safe-tx-hash-mismatch.exception-filter';

function buildMockHost(): {
  host: ArgumentsHost;
  mockStatus: Mock;
  mockSend: Mock;
} {
  const mockSend = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ send: mockSend });
  const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
  const mockSwitchToHttp = jest
    .fn()
    .mockReturnValue({ getResponse: mockGetResponse });
  const host = {
    switchToHttp: mockSwitchToHttp,
  } as unknown as ArgumentsHost;
  return { host, mockStatus, mockSend };
}

describe('SafeTxHashMismatchExceptionFilter', () => {
  let filter: SafeTxHashMismatchExceptionFilter;

  beforeEach(() => {
    filter = new SafeTxHashMismatchExceptionFilter();
  });

  it('should respond with HTTP 422 and the error message', () => {
    const safeTxHash = faker.string.hexadecimal({
      length: 64,
      casing: 'lower',
    }) as Hex;
    const error = new SafeTxHashMismatchError(safeTxHash);
    const { host, mockStatus, mockSend } = buildMockHost();

    filter.catch(error, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockSend).toHaveBeenCalledWith({
      message: error.message,
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  });

  it('should include the safeTxHash in the response message', () => {
    const safeTxHash = faker.string.hexadecimal({
      length: 64,
      casing: 'lower',
    }) as Hex;
    const error = new SafeTxHashMismatchError(safeTxHash);
    const { host, mockSend } = buildMockHost();

    filter.catch(error, host);

    const { message } = mockSend.mock.calls[0][0] as { message: string };
    expect(message).toContain(safeTxHash);
  });
});
