// SPDX-License-Identifier: FSL-1.1-MIT
import {
  assertAuthenticated,
  getAuthenticatedUserId,
} from '@/modules/auth/utils/assert-authenticated.utils';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import {
  siweAuthPayloadDtoBuilder,
  oidcAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { UnauthorizedException } from '@nestjs/common';

describe('assert-authenticated.utils', () => {
  describe('assertAuthenticated', () => {
    it('should throw UnauthorizedException for unauthenticated payload', () => {
      expect(() => assertAuthenticated(new AuthPayload())).toThrow(
        new UnauthorizedException('Not authenticated'),
      );
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should not throw for %s authenticated payload',
      (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());
        expect(() => assertAuthenticated(authPayload)).not.toThrow();
      },
    );
  });

  describe('getAuthenticatedUserId', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should return numeric userId for %s payload',
      (_label, builder) => {
        const dto = builder().build();
        const authPayload = new AuthPayload(dto);

        const userId = getAuthenticatedUserId(authPayload);

        expect(userId).toBe(Number(dto.sub));
        expect(Number.isInteger(userId)).toBe(true);
      },
    );

    it('should throw UnauthorizedException for unauthenticated payload', () => {
      expect(() => getAuthenticatedUserId(new AuthPayload())).toThrow(
        new UnauthorizedException('Not authenticated'),
      );
    });
  });
});
