// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { toSecondsTimestamp } from '#/domain/common/utils/time';

// The signed exp is floored to whole seconds; this leaves at least a second for
// the controller to re-verify the token and set a cookie with a non-zero Max-Age
export const MIN_TOKEN_LIFETIME_SECONDS = 2;

export function getMaxExpirationTime(maxValidityPeriodInSeconds: number): Date {
  return new Date(Date.now() + maxValidityPeriodInSeconds * 1_000);
}

export function assertExpirationTime(
  expirationTime: Date,
  maxExpirationTime: Date,
  maxValidityPeriodInSeconds: number,
): void {
  if (expirationTime > maxExpirationTime) {
    throw new ForbiddenException(
      `Cannot issue token for longer than ${maxValidityPeriodInSeconds} seconds`,
    );
  }
}

// Same 401 as an expired message rejected by the SiWE schema
export function assertMinimumTokenLifetime(
  expirationTime: Date,
  now: Date,
): void {
  const lifetimeInMs =
    toSecondsTimestamp(expirationTime) * 1_000 - now.getTime();
  if (lifetimeInMs < MIN_TOKEN_LIFETIME_SECONDS * 1_000) {
    throw new UnauthorizedException('Invalid message');
  }
}
