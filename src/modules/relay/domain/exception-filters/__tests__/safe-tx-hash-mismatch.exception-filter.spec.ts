// SPDX-License-Identifier: FSL-1.1-MIT
import type { ArgumentsHost } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { SafeTxHashMismatchError } from '@/modules/relay/domain/errors/safe-tx-hash-mismatch.error';
import { SafeTxHashMismatchExceptionFilter } from '@/modules/relay/domain/exception-filters/safe-tx-hash-mismatch.exception-filter';

function buildMockHost(): {
  host: ArgumentsHost;
  mockStatus: jest.Mock;
  mockJson: jest.Mock;
} {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
  const mockSwitchToHttp = jest
    .fn()
    .mockReturnValue({ getResponse: mockGetResponse });
  const host = {
    switchToHttp: mockSwitchToHttp,
  } as unknown as ArgumentsHost;
  return { host, mockStatus, mockJson };
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
    const { host, mockStatus, mockJson } = buildMockHost();

    filter.catch(error, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockJson).toHaveBeenCalledWith({
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
    const { host, mockJson } = buildMockHost();

    filter.catch(error, host);

    const { message } = mockJson.mock.calls[0][0] as { message: string };
    expect(message).toContain(safeTxHash);
  });
});
