// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RateLimitGuard } from '@/routes/common/guards/rate-limit.guard';

/**
 * Wraps `RateLimitGuard.canActivate` to attach `Retry-After` and
 * `Cache-Control: no-store` to the response before the 429 propagates.
 *
 * Why this lives in a helper: the parent `RateLimitGuard` keeps `rateLimit`
 * private, so subclasses cannot access the window. We re-pass the window into
 * this wrapper from each subclass that already has its own copy.
 */
export async function canActivateWithRateLimitHeaders(
  guard: RateLimitGuard,
  context: ExecutionContext,
  windowSeconds: number,
): Promise<boolean> {
  try {
    return await guard.canActivate(context);
  } catch (err) {
    if (
      err instanceof HttpException &&
      err.getStatus() === HttpStatus.TOO_MANY_REQUESTS
    ) {
      const res = context.switchToHttp().getResponse<Response>();
      if (!res.headersSent) {
        res.setHeader('Retry-After', String(windowSeconds));
        res.setHeader('Cache-Control', 'no-store');
      }
    }
    throw err;
  }
}
