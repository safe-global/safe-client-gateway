// SPDX-License-Identifier: FSL-1.1-MIT
import type { Request } from 'express';

/**
 * Extracts the client IP address from an Express request.
 *
 * Priority order:
 * 1. First entry of `x-forwarded-for` header (set by reverse proxies)
 * 2. `request.ip` (Express-resolved IP, already proxy-aware when trust proxy is set)
 * 3. Raw `request.socket.remoteAddress` as a final fallback
 */
export function getClientIp(request: Partial<Request>): string | undefined {
  return (
    (request.headers?.['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() ||
    request.ip ||
    request.socket?.remoteAddress
  );
}
