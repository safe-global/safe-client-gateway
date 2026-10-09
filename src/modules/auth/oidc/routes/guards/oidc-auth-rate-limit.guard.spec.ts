// SPDX-License-Identifier: FSL-1.1-MIT

import { describe, expect, it, jest } from 'bun:test';
import { faker } from '@faker-js/faker';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import type { IConfigurationService } from '#/config/configuration.service.interface';
import type { ICacheService } from '#/datasources/cache/cache.service.interface';
import type { ILoggingService } from '#/logging/logging.interface';
import { RateLimitGuard } from '#/routes/common/guards/rate-limit.guard';
import { OidcAuthRateLimitGuard } from './oidc-auth-rate-limit.guard';

const mockCacheService = mocked({
  increment: jest.fn(),
} as MockedObject<ICacheService>);

const mockLoggingService = {
  warn: jest.fn(),
} as MockedObject<ILoggingService>;

describe('OidcAuthRateLimitGuard', () => {
  it('should extend RateLimitGuard with auth rate limit config', () => {
    const max = faker.number.int({ min: 1, max: 10 });
    const windowSeconds = faker.number.int({ min: 10, max: 120 });

    const mockConfigurationService = {
      get: jest.fn(),
      getOrThrow: jest.fn((key: string) => {
        switch (key) {
          case 'auth.rateLimit.max':
            return max;
          case 'auth.rateLimit.windowSeconds':
            return windowSeconds;
          default:
            throw new Error(`Unexpected key: ${key}`);
        }
      }),
    } as unknown as MockedObject<IConfigurationService>;

    const guard = new OidcAuthRateLimitGuard(
      mockConfigurationService,
      mockCacheService,
      mockLoggingService,
    );

    expect(guard).toBeInstanceOf(RateLimitGuard);
    expect(mockConfigurationService.getOrThrow).toHaveBeenCalledWith(
      'auth.rateLimit.max',
    );
    expect(mockConfigurationService.getOrThrow).toHaveBeenCalledWith(
      'auth.rateLimit.windowSeconds',
    );
  });
});
