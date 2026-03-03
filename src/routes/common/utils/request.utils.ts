// SPDX-License-Identifier: FSL-1.1-MIT
import type { Request } from 'express';

/**
 * Extracts the client IP address from an Express request.
 *
 * Priority order:
 * 1. First entry of `x-forwarded-for` header (set by reverse proxies)
 * 2. `request.ip` (Express-resolved IP, already proxy-aware when trust proxy is set)
 * 3. Raw `request.socket.remoteAddress` as a final fallback
 *
 * @warning `x-forwarded-for` is client-spoofable if the app is not deployed
 * behind a trusted reverse proxy that overwrites this header. This function
 * assumes the deployment topology guarantees a trusted proxy. A follow-up
 * should configure Express `trust proxy` so that `request.ip` handles the
 * header safely, making the explicit `x-forwarded-for` parsing redundant.
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
