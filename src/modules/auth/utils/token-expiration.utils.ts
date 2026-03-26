// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException } from '@nestjs/common';

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
