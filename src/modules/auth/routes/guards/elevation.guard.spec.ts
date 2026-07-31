// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { getAddress } from 'viem';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { AuthPayloadDto } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthMethod } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import {
  ELEVATION_REQUIRED_ERROR,
  ElevationGuard,
} from '@/modules/auth/routes/guards/elevation.guard';

// Deliberately not the production default (30 minutes): a test window that
// matched it would still pass if the guard hardcoded the constant instead of
// reading `auth.elevationWindowSeconds` from configuration.
const ELEVATION_WINDOW_SECONDS = 5 * 60;

describe('ElevationGuard', () => {
  let target: ElevationGuard;

  const nowSeconds = (): number => Math.floor(Date.now() / 1_000);

  const buildContext = (payload?: AuthPayloadDto): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          [AuthGuard.AUTH_PAYLOAD_REQUEST_PROPERTY]: payload,
        }),
      }),
    }) as unknown as ExecutionContext;

  const oidcPayload = (mfaVerifiedAt?: number): AuthPayloadDto => ({
    auth_method: AuthMethod.Oidc,
    sub: faker.string.numeric({ exclude: ['0'] }),
    mfa_verified_at: mfaVerifiedAt,
  });

  const siwePayload = (): AuthPayloadDto => ({
    auth_method: AuthMethod.Siwe,
    sub: faker.string.numeric({ exclude: ['0'] }),
    chain_id: faker.string.numeric({ exclude: ['0'] }),
    signer_address: getAddress(faker.finance.ethereumAddress()),
  });

  beforeEach(() => {
    const configurationService = new FakeConfigurationService();
    configurationService.set('features.mfaStepUp', true);
    configurationService.set(
      'auth.elevationWindowSeconds',
      ELEVATION_WINDOW_SECONDS,
    );
    target = new ElevationGuard(configurationService);
  });

  describe('when features.mfaStepUp is off', () => {
    let disabledTarget: ElevationGuard;

    beforeEach(() => {
      const configurationService = new FakeConfigurationService();
      configurationService.set('features.mfaStepUp', false);
      configurationService.set(
        'auth.elevationWindowSeconds',
        ELEVATION_WINDOW_SECONDS,
      );
      disabledTarget = new ElevationGuard(configurationService);
    });

    it.each([
      ['a session that never presented a second factor', undefined],
      ['a session whose window has expired', 1],
    ])('should admit %s', (_label, mfaVerifiedAt) => {
      const context = buildContext(
        oidcPayload(
          mfaVerifiedAt === undefined
            ? undefined
            : nowSeconds() - ELEVATION_WINDOW_SECONDS - mfaVerifiedAt,
        ),
      );

      expect(disabledTarget.canActivate(context)).toBe(true);
    });

    it('should admit a request with no auth payload at all', () => {
      // AuthGuard still rejects these; the flag only disables elevation.
      expect(disabledTarget.canActivate(buildContext(undefined))).toBe(true);
    });
  });

  describe('OIDC sessions', () => {
    it('should allow a session whose second factor is within the window', () => {
      const context = buildContext(oidcPayload(nowSeconds()));

      expect(target.canActivate(context)).toBe(true);
    });

    it('should allow a session at the very edge of the window', () => {
      const context = buildContext(
        oidcPayload(nowSeconds() - ELEVATION_WINDOW_SECONDS),
      );

      expect(target.canActivate(context)).toBe(true);
    });

    it('should reject a session one second past the window', () => {
      const context = buildContext(
        oidcPayload(nowSeconds() - ELEVATION_WINDOW_SECONDS - 1),
      );

      expect(() => target.canActivate(context)).toThrow(ForbiddenException);
      expect(() => target.canActivate(context)).toThrow(
        ELEVATION_REQUIRED_ERROR,
      );
    });

    it('should reject a session that never presented a second factor', () => {
      const context = buildContext(oidcPayload(undefined));

      expect(() => target.canActivate(context)).toThrow(
        ELEVATION_REQUIRED_ERROR,
      );
    });

    it('should reject a stamp in the future rather than treat it as fresh', () => {
      const context = buildContext(
        oidcPayload(nowSeconds() + ELEVATION_WINDOW_SECONDS * 10),
      );

      expect(() => target.canActivate(context)).toThrow(
        ELEVATION_REQUIRED_ERROR,
      );
    });
  });

  describe('SIWE sessions', () => {
    it('should allow SIWE sessions, which carry no MFA proof until M3', () => {
      const context = buildContext(siwePayload());

      expect(target.canActivate(context)).toBe(true);
    });
  });

  describe('unauthenticated requests', () => {
    // AuthGuard runs first and rejects these; the guard must still fail
    // closed rather than treat a missing payload as elevated.
    it('should reject a request with no auth payload attached', () => {
      const context = buildContext(undefined);

      expect(() => target.canActivate(context)).toThrow(
        ELEVATION_REQUIRED_ERROR,
      );
    });
  });
});
