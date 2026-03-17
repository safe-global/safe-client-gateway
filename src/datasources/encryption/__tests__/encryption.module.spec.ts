// SPDX-License-Identifier: FSL-1.1-MIT
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { DecryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { mockClient } from 'aws-sdk-client-mock';
import { randomBytes } from 'crypto';
import { EncryptionLocator } from '@/datasources/encryption/encryption-locator';
import {
  EncryptionModule,
  EncryptionProvider,
} from '@/datasources/encryption/encryption.module';
import { IEncryptionService } from '@/datasources/encryption/encryption.service.interface';
import { ConfigurationModule } from '@/config/configuration.module';
import testConfiguration from '@/config/entities/__tests__/configuration';
import type configuration from '@/config/entities/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { ClsModule } from 'nestjs-cls';

const kmsMock = mockClient(KMSClient);

const dekPlaintext = randomBytes(32);
const hmacPlaintext = randomBytes(32);

function createTestConfig(
  overrides: Partial<ReturnType<typeof configuration>['encryption']>,
): typeof testConfiguration {
  const base = testConfiguration();
  return () => {
    const config = {
      ...base,
      encryption: {
        ...base.encryption,
        ...overrides,
      },
    };
    if (overrides.localKeys === undefined && 'localKeys' in overrides) {
      delete (config.encryption as Record<string, unknown>).localKeys;
    }
    if (overrides.hmacSecret === undefined && 'hmacSecret' in overrides) {
      delete (config.encryption as Record<string, unknown>).hmacSecret;
    }
    if (overrides.deksEncrypted === undefined && 'deksEncrypted' in overrides) {
      delete (config.encryption as Record<string, unknown>).deksEncrypted;
    }
    if (
      overrides.hmacKeyEncrypted === undefined &&
      'hmacKeyEncrypted' in overrides
    ) {
      delete (config.encryption as Record<string, unknown>).hmacKeyEncrypted;
    }
    return config;
  };
}

describe('EncryptionModule', () => {
  beforeEach(() => {
    kmsMock.reset();
    EncryptionLocator['service'] = null;
  });

  describe('local provider', () => {
    it('should initialize with local provider and create working service', async () => {
      const localKey = randomBytes(32).toString('hex');
      const hmacSecret = randomBytes(32).toString('hex');

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          EncryptionModule.register(),
          ConfigurationModule.register(
            createTestConfig({
              provider: EncryptionProvider.LOCAL,
              localKeys: { '1': localKey },
              hmacSecret,
              currentVersion: 1,
            }),
          ),
          ClsModule.forRoot({ global: true }),
          RequestScopedLoggingModule,
        ],
      }).compile();

      const service =
        await module.resolve<IEncryptionService>(IEncryptionService);

      const { ciphertext, version } = service.encrypt('test');
      expect(service.decrypt(ciphertext, version)).toBe('test');
      expect(EncryptionLocator.getService()).toBe(service);

      await module.close();
    });

    it('should throw when localKeys is missing', async () => {
      const hmacSecret = randomBytes(32).toString('hex');

      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.LOCAL,
                localKeys: undefined as unknown as Record<string, string>,
                hmacSecret,
                currentVersion: 1,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow();
    });

    it('should throw when hmacSecret is missing', async () => {
      const localKey = randomBytes(32).toString('hex');

      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.LOCAL,
                localKeys: { '1': localKey },
                hmacSecret: undefined as unknown as string,
                currentVersion: 1,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow();
    });

    it('should throw when localKey is invalid hex', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.LOCAL,
                localKeys: { '1': 'not-valid-hex!!!' },
                hmacSecret: randomBytes(32).toString('hex'),
                currentVersion: 1,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow('DEK for version 1 must be 32 bytes');
    });

    it('should support multiple local keys for DEK rotation', async () => {
      const localKey = randomBytes(32).toString('hex');
      const localKeyV2 = randomBytes(32).toString('hex');
      const hmacSecret = randomBytes(32).toString('hex');

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          EncryptionModule.register(),
          ConfigurationModule.register(
            createTestConfig({
              provider: EncryptionProvider.LOCAL,
              localKeys: { '1': localKey, '2': localKeyV2 },
              hmacSecret,
              currentVersion: 2,
            }),
          ),
          ClsModule.forRoot({ global: true }),
          RequestScopedLoggingModule,
        ],
      }).compile();

      const service =
        await module.resolve<IEncryptionService>(IEncryptionService);

      const { ciphertext, version } = service.encrypt('rotated');
      expect(version).toBe(2);
      expect(service.decrypt(ciphertext, version)).toBe('rotated');

      await module.close();
    });

    it('should throw when currentVersion is 2 but no key for v2 is provided', async () => {
      const localKey = randomBytes(32).toString('hex');
      const hmacSecret = randomBytes(32).toString('hex');

      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.LOCAL,
                localKeys: { '1': localKey },
                hmacSecret,
                currentVersion: 2,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow('Current version 2 not found');
    });
  });

  describe('AWS provider', () => {
    const dekV1Encrypted = Buffer.from(dekPlaintext).toString('base64');
    const hmacKeyEncrypted = Buffer.from(hmacPlaintext).toString('base64');

    it('should initialize with AWS provider when KMS succeeds', async () => {
      kmsMock.on(DecryptCommand).resolves({
        Plaintext: new Uint8Array(dekPlaintext),
      });

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          EncryptionModule.register(),
          ConfigurationModule.register(
            createTestConfig({
              provider: EncryptionProvider.AWS,
              deksEncrypted: { '1': dekV1Encrypted },
              hmacKeyEncrypted,
              currentVersion: 1,
            }),
          ),
          ClsModule.forRoot({ global: true }),
          RequestScopedLoggingModule,
        ],
      }).compile();

      const service =
        await module.resolve<IEncryptionService>(IEncryptionService);

      const { ciphertext, version } = service.encrypt('aws-test');
      expect(service.decrypt(ciphertext, version)).toBe('aws-test');

      await module.close();
    });

    it('should throw when KMS Decrypt returns empty Plaintext', async () => {
      kmsMock.on(DecryptCommand).resolves({ Plaintext: undefined });

      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.AWS,
                deksEncrypted: { '1': dekV1Encrypted },
                hmacKeyEncrypted,
                currentVersion: 1,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow('KMS Decrypt returned empty plaintext');
    });

    it('should throw when KMS is unavailable', async () => {
      kmsMock.on(DecryptCommand).rejects(new Error('KMS unavailable'));

      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.AWS,
                deksEncrypted: { '1': dekV1Encrypted },
                hmacKeyEncrypted,
                currentVersion: 1,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow();
    });

    it('should throw when deksEncrypted is missing', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.AWS,
                deksEncrypted: undefined as unknown as Record<string, string>,
                hmacKeyEncrypted,
                currentVersion: 1,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow();
    });

    it('should throw when hmacKeyEncrypted is missing', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.AWS,
                deksEncrypted: { '1': dekV1Encrypted },
                hmacKeyEncrypted: undefined as unknown as string,
                currentVersion: 1,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow();
    });

    it('should support multiple DEKs for key rotation', async () => {
      const dekV2Plaintext = randomBytes(32);
      const dekV2Encrypted = Buffer.from(dekV2Plaintext).toString('base64');

      let callCount = 0;
      kmsMock.on(DecryptCommand).callsFake(() => {
        callCount++;
        // Call order: hmac first (parallel), then deks in order
        if (callCount === 1) {
          return Promise.resolve({
            Plaintext: new Uint8Array(hmacPlaintext),
          });
        }
        if (callCount === 2) {
          return Promise.resolve({
            Plaintext: new Uint8Array(dekPlaintext),
          });
        }
        return Promise.resolve({
          Plaintext: new Uint8Array(dekV2Plaintext),
        });
      });

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          EncryptionModule.register(),
          ConfigurationModule.register(
            createTestConfig({
              provider: EncryptionProvider.AWS,
              deksEncrypted: {
                '1': dekV1Encrypted,
                '2': dekV2Encrypted,
              },
              hmacKeyEncrypted,
              currentVersion: 2,
            }),
          ),
          ClsModule.forRoot({ global: true }),
          RequestScopedLoggingModule,
        ],
      }).compile();

      const service =
        await module.resolve<IEncryptionService>(IEncryptionService);

      // Encrypt with v2
      const { ciphertext: v2Ct, version } = service.encrypt('v2-aws');
      expect(version).toBe(2);
      expect(service.decrypt(v2Ct, 2)).toBe('v2-aws');

      // v1 data encrypted with dekPlaintext is still decryptable
      const v1Service = new (
        await import('@/datasources/encryption/encryption.service')
      ).EncryptionService(new Map([[1, dekPlaintext]]), 1, hmacPlaintext);
      const { ciphertext: v1Ct } = v1Service.encrypt('v1-aws');
      expect(service.decrypt(v1Ct, 1)).toBe('v1-aws');

      await module.close();
    });

    it('should throw when KMS returns empty for a DEK', async () => {
      let callCount = 0;
      kmsMock.on(DecryptCommand).callsFake(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            Plaintext: new Uint8Array(hmacPlaintext),
          });
        }
        return Promise.resolve({ Plaintext: undefined });
      });

      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.AWS,
                deksEncrypted: { '1': dekV1Encrypted },
                hmacKeyEncrypted,
                currentVersion: 1,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow('KMS Decrypt returned empty plaintext');
    });

    it('should throw when currentVersion has no matching DEK', async () => {
      kmsMock.on(DecryptCommand).resolves({
        Plaintext: new Uint8Array(dekPlaintext),
      });

      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.AWS,
                deksEncrypted: { '1': dekV1Encrypted },
                hmacKeyEncrypted,
                currentVersion: 2,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow('Current version 2 not found');
    });
  });

  describe('provider validation', () => {
    it('should throw for unknown provider', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: 'invalid' as EncryptionProvider,
                localKeys: {
                  '1': randomBytes(32).toString('hex'),
                },
                hmacSecret: randomBytes(32).toString('hex'),
                currentVersion: 1,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow('Unknown encryption provider: invalid');
    });
  });
});
