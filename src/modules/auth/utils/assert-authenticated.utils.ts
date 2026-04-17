// SPDX-License-Identifier: FSL-1.1-MIT

import { UnauthorizedException } from '@nestjs/common';
import type {
  AuthenticatedAuthPayload,
  AuthPayload,
} from '@/modules/auth/domain/entities/auth-payload.entity';

/**
 * Asserts that the given {@link AuthPayload} is authenticated.
 * Narrows the type to {@link AuthenticatedAuthPayload}, guaranteeing
 * `sub` and `auth_method` are present.
 *
 * @throws {UnauthorizedException} If the payload is not authenticated.
 */
export function assertAuthenticated(
  authPayload: AuthPayload,
): asserts authPayload is AuthenticatedAuthPayload {
  if (!authPayload.isAuthenticated()) {
    throw new UnauthorizedException('Not authenticated');
  }
}

/**
 * Asserts authentication and returns the numeric user ID from
 * the JWT `sub` claim.
 *
 * @throws {UnauthorizedException} If the payload is not authenticated.
 */
export function getAuthenticatedUserIdOrFail(authPayload: AuthPayload): number {
  assertAuthenticated(authPayload);
  return Number(authPayload.sub);
}
