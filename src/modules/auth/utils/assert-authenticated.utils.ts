// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  AuthPayload,
  AuthenticatedAuthPayload,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import { UnauthorizedException } from '@nestjs/common';

export function assertAuthenticated(
  authPayload: AuthPayload,
): asserts authPayload is AuthenticatedAuthPayload {
  if (!authPayload.isAuthenticated()) {
    throw new UnauthorizedException('Not authenticated');
  }
}

export function getAuthenticatedUserId(authPayload: AuthPayload): number {
  assertAuthenticated(authPayload);
  return Number(authPayload.sub);
}
