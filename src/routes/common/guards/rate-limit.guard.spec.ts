import { RateLimitGuard } from './rate-limit.guard';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker/.';

const mockCacheService = jest.mocked({
  increment: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>);

const mockLoggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('RateLimitGuard', () => {
  it('should allow the request if under the rate limit', async () => {
    const ip = faker.internet.ipv4();
    const path = new URL(faker.internet.url()).pathname;
    const windowSeconds = faker.number.int({ min: 10, max: 20 });
    const mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          ip,
          route: { path },
          method: 'POST',
        }),
      }),
    } as jest.MockedObjectDeep<ExecutionContext>;
    mockCacheService.increment.mockResolvedValue(1); // under or equal to the limit
    const guard = new RateLimitGuard(mockCacheService, mockLoggingService, {
      max: faker.number.int({ min: 1, max: 10 }),
      windowSeconds,
    });

    const result = await guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(mockCacheService.increment).toHaveBeenCalledWith(
      `${path}_POST_${ip}_rate_limit`,
      windowSeconds,
    );
  });

  it('should block the request if over the rate limit', async () => {
    const ip = faker.internet.ip();
    const path = new URL(faker.internet.url()).pathname;
    const windowSeconds = faker.number.int({ min: 10, max: 20 });
    const maxRequests = faker.number.int({ min: 2, max: 10 });
    const mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          ip,
          route: { path },
          method: 'PATCH',
        }),
      }),
    } as jest.MockedObjectDeep<ExecutionContext>;
    mockCacheService.increment.mockResolvedValue(maxRequests + 1); // over the limit
    const guard = new RateLimitGuard(mockCacheService, mockLoggingService, {
      max: maxRequests,
      windowSeconds,
    });

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      new HttpException('Rate limit reached', HttpStatus.TOO_MANY_REQUESTS),
    );

    expect(mockCacheService.increment).toHaveBeenCalledWith(
      `${path}_PATCH_${ip}_rate_limit`,
      windowSeconds,
    );
    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RATE_LIMIT',
        method: 'PATCH',
        route: path,
        clientIp: ip,
        maxRequests,
        windowSeconds,
        currentRequest: maxRequests + 1,
      }),
    );
  });

  it('should log a warning for invalid client IP', async () => {
    const invalidIp = faker.string.sample(10);
    const path = new URL(faker.internet.url()).pathname;
    const mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          ip: invalidIp,
          route: { path },
          method: 'PATCH',
        }),
      }),
    } as jest.MockedObjectDeep<ExecutionContext>;
    mockCacheService.increment.mockResolvedValue(1);
    const guard = new RateLimitGuard(mockCacheService, mockLoggingService, {
      max: faker.number.int({ min: 1, max: 10 }),
      windowSeconds: faker.number.int({ min: 1, max: 10 }),
    });

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      new BadRequestException('Invalid client IP address'),
    );

    expect(mockLoggingService.warn).toHaveBeenCalledWith({
      clientIp: invalidIp,
      method: 'PATCH',
      route: path,
      type: 'INVALID_IP',
    });
  });
});
