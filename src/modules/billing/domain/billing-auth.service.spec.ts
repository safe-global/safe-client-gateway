// SPDX-License-Identifier: FSL-1.1-MIT

import { sign as cryptoSign, generateKeyPairSync } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { JWT_ES_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { jwtClientFactory } from '@/datasources/jwt/jwt.module';
import { JwtService } from '@/datasources/jwt/jwt.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT } from '@/modules/billing/domain/billing-auth.constants';
import { BillingAuthService } from '@/modules/billing/domain/billing-auth.service';
import {
  SERVICE_ACCESS_PERMISSION_TYPE,
  SERVICE_ACCESS_ROLE,
  SERVICE_USER_TYPE,
} from '@/modules/billing/domain/entities/billing-service-token.entity';

const ISSUER = faker.lorem.slug();

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
        expiresInDays: faker.number.int({ min: 1, max: 365 }),
      });

      expect(jwtClientFactory().decodeWithoutVerification(token)).toMatchObject(
        {
          iss: ISSUER,
          sub: DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT,
          aud: [ISSUER],
          roles: [SERVICE_ACCESS_ROLE],
          data: {
            service_name: DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT,
            permission_type: SERVICE_ACCESS_PERMISSION_TYPE,
            user_type: SERVICE_USER_TYPE,
          },
        },
      );
    });

    it('honours a custom subject and reflects it in service_name', () => {
      const { privateKey } = generateKeyPair();
      const subject = faker.lorem.slug();

      const token = BillingAuthService.mint({
        privateKey,
        issuer: ISSUER,
        expiresInDays: faker.number.int({ min: 1, max: 365 }),
        subject,
      });

      expect(jwtClientFactory().decodeWithoutVerification(token)).toMatchObject(
        {
          sub: subject,
          data: { service_name: subject },
        },
      );
    });

    it('derives iat/exp from the issued-at time and expiresInDays', () => {
      const { privateKey } = generateKeyPair();
      // Whole seconds so the second-based NumericDate comparison is exact.
      const now = faker.date.recent();
      now.setMilliseconds(0);
      const nowInSeconds = now.getTime() / 1_000;
      const expiresInDays = faker.number.int({ min: 1, max: 365 });

      const token = BillingAuthService.mint({
        privateKey,
        issuer: ISSUER,
        expiresInDays,
        now,
      });

      const decoded = jwtClientFactory().decodeWithoutVerification(token);
      expect(decoded?.iat).toBe(nowInSeconds);
      expect(decoded?.exp).toBe(nowInSeconds + expiresInDays * 24 * 60 * 60);
    });
  });

  describe('verify', () => {
    function createService(publicKey: string): BillingAuthService {
      const configurationService = new FakeConfigurationService();
      configurationService.set('jwt.issuer', ISSUER);
      // Arbitrary: the HMAC secret is unused for ES256 verification.
      configurationService.set('jwt.secret', faker.string.alphanumeric(32));
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
        expiresInDays: faker.number.int({ min: 1, max: 365 }),
      });

      expect(service.verify(token)).toMatchObject({
        roles: [SERVICE_ACCESS_ROLE],
      });
    });

    it('verifies a token minted via mintViaSigner (KMS-style DER signer)', async () => {
      const { privateKey, publicKey } = generateKeyPair();
      const service = createService(publicKey);

      // Mimics AWS KMS Sign (RAW + ECDSA_SHA_256): hashes with SHA-256 and
      // returns a DER-encoded ECDSA signature.
      const sign = (input: Buffer): Promise<Buffer> =>
        Promise.resolve(
          cryptoSign('sha256', input, { key: privateKey, dsaEncoding: 'der' }),
        );

      const token = await BillingAuthService.mintViaSigner(
        {
          issuer: ISSUER,
          subject: DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT,
          expiresInDays: faker.number.int({ min: 1, max: 365 }),
        },
        sign,
      );

      // Same claim shape as the local-key path...
      expect(jwtClientFactory().decodeWithoutVerification(token)).toMatchObject(
        {
          iss: ISSUER,
          aud: [ISSUER],
          roles: [SERVICE_ACCESS_ROLE],
          data: { service_name: DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT },
        },
      );
      // ...and the ES256 signature verifies against the matching public key.
      expect(service.verify(token)).toMatchObject({
        roles: [SERVICE_ACCESS_ROLE],
      });
    });

    it('rejects a tampered token', () => {
      const { privateKey, publicKey } = generateKeyPair();
      const service = createService(publicKey);

      const token = BillingAuthService.mint({
        privateKey,
        issuer: ISSUER,
        expiresInDays: faker.number.int({ min: 1, max: 365 }),
      });

      // Excluding the original characters guarantees the signature changes.
      const tamperedSuffix = faker.string.alphanumeric({
        length: 4,
        exclude: token.slice(-4),
      });

      expect(() =>
        service.verify(`${token.slice(0, -4)}${tamperedSuffix}`),
      ).toThrow(UnauthorizedException);
    });

    it('rejects a token signed by a different key', () => {
      const { publicKey } = generateKeyPair();
      const { privateKey: otherPrivateKey } = generateKeyPair();
      const service = createService(publicKey);

      const token = BillingAuthService.mint({
        privateKey: otherPrivateKey,
        issuer: ISSUER,
        expiresInDays: faker.number.int({ min: 1, max: 365 }),
      });

      expect(() => service.verify(token)).toThrow(UnauthorizedException);
    });

    it('rejects a validly-signed token that is not a service token', () => {
      const { privateKey, publicKey } = generateKeyPair();
      const service = createService(publicKey);

      // missing the service markers (no SERVICE_ACCESS role and no data), so layer-2 authorization fails.
      const token = jwtClientFactory().sign(
        {
          iss: ISSUER,
          sub: 'billing-service',
          aud: [ISSUER],
          exp: faker.date.future(),
          roles: [faker.string.alpha({ length: 16, casing: 'upper' })],
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
      // Arbitrary: the HMAC secret is unused for ES256 verification.
      configurationService.set('jwt.secret', faker.string.alphanumeric(32));
      configurationService.set('billing.webhook.issuer', ISSUER);
      // billing.webhook.publicKey intentionally not set.

      expect(
        () =>
          new BillingAuthService(
            new JwtService(jwtClientFactory(), configurationService),
            configurationService,
            loggingService,
          ),
      ).toThrow('No value set for key billing.webhook.publicKey');
    });
  });
});
