// SPDX-License-Identifier: FSL-1.1-MIT

import { generateKeyPairSync } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { JWT_ES_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { jwtClientFactory } from '@/datasources/jwt/jwt.module';
import { JwtService } from '@/datasources/jwt/jwt.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { BillingAuthService } from '@/modules/billing/domain/billing-auth.service';

const ISSUER = 'safe-client-gateway';

function generateKeyPair(): { privateKey: string; publicKey: string } {
  return generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

describe('BillingAuthService', () => {
  const loggingService = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as MockedObject<ILoggingService>;

  describe('mint (static)', () => {
    it('mints a token with the expected service claims', () => {
      const { privateKey } = generateKeyPair();

      const token = BillingAuthService.mint({
        privateKey,
        issuer: ISSUER,
        expiresInDays: 365,
      });

      expect(jwtClientFactory().decodeWithoutVerification(token)).toMatchObject(
        {
          iss: ISSUER,
          sub: 'billing-service',
          aud: [ISSUER],
          roles: ['SERVICE_ACCESS'],
          data: {
            service_name: 'billing-service',
            permission_type: 'SERVICE_ACCESS',
            user_type: 'SERVICE_USER',
          },
        },
      );
    });

    it('honours a custom subject and reflects it in service_name', () => {
      const { privateKey } = generateKeyPair();

      const token = BillingAuthService.mint({
        privateKey,
        issuer: ISSUER,
        expiresInDays: 365,
        subject: 'billing-service-staging',
      });

      expect(jwtClientFactory().decodeWithoutVerification(token)).toMatchObject(
        {
          sub: 'billing-service-staging',
          data: { service_name: 'billing-service-staging' },
        },
      );
    });

    it('derives iat/exp from the issued-at time and expiresInDays', () => {
      const { privateKey } = generateKeyPair();
      // Whole seconds so the second-based NumericDate comparison is exact.
      const now = new Date(1_700_000_000_000);
      const expiresInDays = 365;

      const token = BillingAuthService.mint({
        privateKey,
        issuer: ISSUER,
        expiresInDays,
        now,
      });

      const decoded = jwtClientFactory().decodeWithoutVerification(token);
      expect(decoded?.iat).toBe(1_700_000_000);
      expect(decoded?.exp).toBe(1_700_000_000 + expiresInDays * 24 * 60 * 60);
    });
  });

  describe('verify', () => {
    function createService(publicKey: string): BillingAuthService {
      const configurationService = new FakeConfigurationService();
      configurationService.set('jwt.issuer', ISSUER);
      configurationService.set('jwt.secret', 'unused-for-es256');
      configurationService.set('billing.webhook.publicKey', publicKey);
      configurationService.set('billing.webhook.issuer', ISSUER);

      return new BillingAuthService(
        new JwtService(jwtClientFactory(), configurationService),
        configurationService,
        loggingService,
      );
    }

    it('verifies a token minted with the matching private key', () => {
      const { privateKey, publicKey } = generateKeyPair();
      const service = createService(publicKey);

      const token = BillingAuthService.mint({
        privateKey,
        issuer: ISSUER,
        expiresInDays: 365,
      });

      expect(service.verify(token)).toMatchObject({
        roles: ['SERVICE_ACCESS'],
      });
    });

    it('rejects a tampered token', () => {
      const { privateKey, publicKey } = generateKeyPair();
      const service = createService(publicKey);

      const token = BillingAuthService.mint({
        privateKey,
        issuer: ISSUER,
        expiresInDays: 365,
      });

      expect(() => service.verify(`${token.slice(0, -4)}AAAA`)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a token signed by a different key', () => {
      const { publicKey } = generateKeyPair();
      const { privateKey: otherPrivateKey } = generateKeyPair();
      const service = createService(publicKey);

      const token = BillingAuthService.mint({
        privateKey: otherPrivateKey,
        issuer: ISSUER,
        expiresInDays: 365,
      });

      expect(() => service.verify(token)).toThrow(UnauthorizedException);
    });

    it('rejects a validly-signed token that is not a service token', () => {
      const { privateKey, publicKey } = generateKeyPair();
      const service = createService(publicKey);

      // Valid ES256 signature and iss/aud/exp, but missing the service markers
      // (no SERVICE_ACCESS role and no data), so layer-2 authorization fails.
      const token = jwtClientFactory().sign(
        {
          iss: ISSUER,
          sub: 'billing-service',
          aud: [ISSUER],
          exp: new Date(Date.now() + 60 * 60 * 1_000),
          roles: ['SOME_OTHER_ROLE'],
        },
        { secretOrPrivateKey: privateKey, algorithm: JWT_ES_ALGORITHM },
      );

      expect(() => service.verify(token)).toThrow(UnauthorizedException);
    });
  });

  describe('constructor', () => {
    it('throws when the webhook public key is not configured', () => {
      const configurationService = new FakeConfigurationService();
      configurationService.set('jwt.issuer', ISSUER);
      configurationService.set('jwt.secret', 'unused-for-es256');
      configurationService.set('billing.webhook.issuer', ISSUER);
      // billing.webhook.publicKey intentionally not set.

      expect(
        () =>
          new BillingAuthService(
            new JwtService(jwtClientFactory(), configurationService),
            configurationService,
            loggingService,
          ),
      ).toThrow();
    });
  });
});
