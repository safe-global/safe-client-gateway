// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';

describe('AuthPayload', () => {
  const nowSeconds = (): number => Math.floor(Date.now() / 1_000);

  describe('hasFreshMfa', () => {
    const oidcPayload = (mfaVerifiedAt: number | undefined): AuthPayload =>
      new AuthPayload(
        oidcAuthPayloadDtoBuilder()
          .with('mfa_verified_at', mfaVerifiedAt)
          .build(),
      );

    it.each([
      ['just now', 0],
      ['mid-window', 150],
      ['exactly at the window edge', 300],
    ])('should be fresh %s', (_label, ageSeconds) => {
      const payload = oidcPayload(nowSeconds() - ageSeconds);

      expect(payload.hasFreshMfa(300)).toBe(true);
    });

    it.each([
      ['one second past the window', 301],
      ['long past the window', 60 * 60 * 24],
    ])('should be stale %s', (_label, ageSeconds) => {
      const payload = oidcPayload(nowSeconds() - ageSeconds);

      expect(payload.hasFreshMfa(300)).toBe(false);
    });

    it('should be stale when no second factor was ever presented', () => {
      expect(oidcPayload(undefined).hasFreshMfa(300)).toBe(false);
    });

    it('should treat a future stamp as clock skew, not freshness', () => {
      const payload = oidcPayload(nowSeconds() + 10_000);

      expect(payload.hasFreshMfa(300)).toBe(false);
    });

    it('should never be fresh for a SIWE session, which carries no MFA proof', () => {
      const payload = new AuthPayload(siweAuthPayloadDtoBuilder().build());

      expect(payload.hasFreshMfa(300)).toBe(false);
    });

    it('should never be fresh for an empty payload', () => {
      expect(new AuthPayload().hasFreshMfa(300)).toBe(false);
    });

    it('should not carry mfa_verified_at across auth methods', () => {
      // The field lives on the OIDC branch of the discriminated union only.
      const payload = new AuthPayload(
        siweAuthPayloadDtoBuilder()
          .with('sub', faker.string.numeric({ exclude: ['0'] }))
          .build(),
      );

      expect(payload.mfa_verified_at).toBeUndefined();
    });
  });
});
