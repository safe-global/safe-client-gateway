// SPDX-License-Identifier: FSL-1.1-MIT
import {
  BadRequestException,
  type ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { RateLimitGuard } from '@/routes/common/guards/rate-limit.guard';
import { canActivateWithRateLimitHeaders } from './with-rate-limit-headers';

function buildContext(): {
  context: ExecutionContext;
  setHeader: jest.Mock;
} {
  const setHeader = jest.fn();
  const response = { setHeader, headersSent: false };
  const context = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ExecutionContext;
  return { context, setHeader };
}

describe('canActivateWithRateLimitHeaders', () => {
  it('returns true when the inner guard allows the request', async () => {
    const inner = { canActivate: jest.fn().mockResolvedValue(true) };
    const { context, setHeader } = buildContext();
    await expect(
      canActivateWithRateLimitHeaders(
        inner as unknown as RateLimitGuard,
        context,
        600,
      ),
    ).resolves.toBe(true);
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('attaches Retry-After + no-store on 429 and rethrows', async () => {
    const inner = {
      canActivate: jest
        .fn()
        .mockRejectedValue(
          new HttpException('Rate limit', HttpStatus.TOO_MANY_REQUESTS),
        ),
    };
    const { context, setHeader } = buildContext();
    await expect(
      canActivateWithRateLimitHeaders(
        inner as unknown as RateLimitGuard,
        context,
        600,
      ),
    ).rejects.toThrow(HttpException);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '600');
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('does not touch headers for non-429 errors', async () => {
    const inner = {
      canActivate: jest
        .fn()
        .mockRejectedValue(new BadRequestException('bad ip')),
    };
    const { context, setHeader } = buildContext();
    await expect(
      canActivateWithRateLimitHeaders(
        inner as unknown as RateLimitGuard,
        context,
        600,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(setHeader).not.toHaveBeenCalled();
  });
});
