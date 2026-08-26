// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { Mock } from 'vitest';
import {
  QUOTA_EXCEEDED_ERROR_CODE,
  QuotaExceededError,
} from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { QuotaExceededExceptionFilter } from '@/modules/entitlements/domain/exception-filters/quota-exceeded.exception-filter';

function buildMockHost(): {
  host: ArgumentsHost;
  mockStatus: Mock;
  mockSend: Mock;
} {
  const mockSend = vi.fn();
  const mockStatus = vi.fn().mockReturnValue({ send: mockSend });
  const mockGetResponse = vi.fn().mockReturnValue({ status: mockStatus });
  const mockSwitchToHttp = vi
    .fn()
    .mockReturnValue({ getResponse: mockGetResponse });
  const host = {
    switchToHttp: mockSwitchToHttp,
  } as unknown as ArgumentsHost;
  return { host, mockStatus, mockSend };
}

describe('QuotaExceededExceptionFilter', () => {
  let filter: QuotaExceededExceptionFilter;

  beforeEach(() => {
    filter = new QuotaExceededExceptionFilter();
  });

  it.each([
    ['a reset window', faker.date.future()],
    ['no reset window', null],
  ])(
    'responds 402 with the typed body a client reacts to, with %s',
    (_label, resetsAt) => {
      const quota = faker.number.int({ min: 1, max: 50 });
      const used = quota + faker.number.int({ min: 0, max: 10 });
      const error = new QuotaExceededError({
        feature: 'safe_seats',
        quota,
        used,
        resetsAt,
      });
      const { host, mockStatus, mockSend } = buildMockHost();

      filter.catch(error, host);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.PAYMENT_REQUIRED);
      expect(mockSend).toHaveBeenCalledWith({
        code: QUOTA_EXCEEDED_ERROR_CODE,
        message: expect.any(String),
        feature: 'safe_seats',
        quota,
        used,
        resetsAt: resetsAt?.toISOString() ?? null,
      });
    },
  );
});
