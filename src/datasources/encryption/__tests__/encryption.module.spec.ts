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
import { IFieldEncryptionService } from '@/datasources/encryption/encryption.service.interface';
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
    if (overrides.localKey === undefined && 'localKey' in overrides) {
      delete config.encryption.localKey;
    }
    if (overrides.hmacSecret === undefined && 'hmacSecret' in overrides) {
      delete config.encryption.hmacSecret;
    }
    if (
      overrides.dekV1Encrypted === undefined &&
      'dekV1Encrypted' in overrides
    ) {
      delete config.encryption.dekV1Encrypted;
    }
    if (
      overrides.hmacKeyEncrypted === undefined &&
      'hmacKeyEncrypted' in overrides
    ) {
      delete config.encryption.hmacKeyEncrypted;
    }
    if (
      overrides.dekV2Encrypted === undefined &&
      'dekV2Encrypted' in overrides
    ) {
      delete config.encryption.dekV2Encrypted;
    }
    return config;
  };
}

describe('EncryptionModule', () => {
  beforeEach(() => {
    kmsMock.reset();
    EncryptionLocator.reset();
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
              localKey,
              hmacSecret,
              currentVersion: 1,
            }),
          ),
          ClsModule.forRoot({ global: true }),
          RequestScopedLoggingModule,
        ],
      }).compile();

      const service = await module.resolve<IFieldEncryptionService>(
        IFieldEncryptionService,
      );

      const { ciphertext, version } = service.encrypt('test');
      expect(service.decrypt(ciphertext, version)).toBe('test');
      expect(EncryptionLocator.getService()).toBe(service);

      await module.close();
    });

    it('should throw when localKey is missing', async () => {
      const hmacSecret = randomBytes(32).toString('hex');

      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.LOCAL,
                localKey: undefined as unknown as string,
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
                localKey,
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
                localKey: 'not-valid-hex!!!',
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

    it('should support localKeyV2 for DEK rotation', async () => {
      const localKey = randomBytes(32).toString('hex');
      const localKeyV2 = randomBytes(32).toString('hex');
      const hmacSecret = randomBytes(32).toString('hex');

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          EncryptionModule.register(),
          ConfigurationModule.register(
            createTestConfig({
              provider: EncryptionProvider.LOCAL,
              localKey,
              localKeyV2,
              hmacSecret,
              currentVersion: 2,
            }),
          ),
          ClsModule.forRoot({ global: true }),
          RequestScopedLoggingModule,
        ],
      }).compile();

      const service = await module.resolve<IFieldEncryptionService>(
        IFieldEncryptionService,
      );

      expect(service.currentVersion).toBe(2);
      const { ciphertext, version } = service.encrypt('rotated');
      expect(version).toBe(2);
      expect(service.decrypt(ciphertext, version)).toBe('rotated');

      await module.close();
    });

    it('should throw when currentVersion is 2 but localKeyV2 is not provided', async () => {
      const localKey = randomBytes(32).toString('hex');
      const hmacSecret = randomBytes(32).toString('hex');

      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.LOCAL,
                localKey,
                localKeyV2: undefined,
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
              dekV1Encrypted,
              hmacKeyEncrypted,
              currentVersion: 1,
            }),
          ),
          ClsModule.forRoot({ global: true }),
          RequestScopedLoggingModule,
        ],
      }).compile();

      const service = await module.resolve<IFieldEncryptionService>(
        IFieldEncryptionService,
      );

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
                dekV1Encrypted,
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
                dekV1Encrypted,
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

    it('should throw when dekV1Encrypted is missing', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            EncryptionModule.register(),
            ConfigurationModule.register(
              createTestConfig({
                provider: EncryptionProvider.AWS,
                dekV1Encrypted: undefined as unknown as string,
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
                dekV1Encrypted,
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

    // Key isolation (v1 ciphertext cannot be decrypted with v2 DEK) is tested
    // in field-encryption.service.spec.ts → "DEK rotation" / "KMS exchange"
    it('should support dekV2Encrypted for key rotation', async () => {
      const dekV2Plaintext = randomBytes(32);
      const dekV2Encrypted = Buffer.from(dekV2Plaintext).toString('base64');

      let callCount = 0;
      kmsMock.on(DecryptCommand).callsFake(() => {
        callCount++;
        // Call order: dekV1, hmac (parallel), then dekV2
        if (callCount <= 2) {
          return Promise.resolve({
            Plaintext: new Uint8Array(
              callCount === 1 ? dekPlaintext : hmacPlaintext,
            ),
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
              dekV1Encrypted,
              dekV2Encrypted,
              hmacKeyEncrypted,
              currentVersion: 2,
            }),
          ),
          ClsModule.forRoot({ global: true }),
          RequestScopedLoggingModule,
        ],
      }).compile();

      const service = await module.resolve<IFieldEncryptionService>(
        IFieldEncryptionService,
      );

      // Encrypt with v2
      expect(service.currentVersion).toBe(2);
      const { ciphertext: v2Ct, version } = service.encrypt('v2-aws');
      expect(version).toBe(2);
      expect(service.decrypt(v2Ct, 2)).toBe('v2-aws');

      // v1 data encrypted with dekPlaintext is still decryptable
      const v1Service = new (
        await import('@/datasources/encryption/field-encryption.service')
      ).FieldEncryptionService(new Map([[1, dekPlaintext]]), 1, hmacPlaintext);
      const { ciphertext: v1Ct } = v1Service.encrypt('v1-aws');
      expect(service.decrypt(v1Ct, 1)).toBe('v1-aws');

      await module.close();
    });

    it('should throw when dekV2Encrypted is provided but KMS returns empty for v2', async () => {
      const dekV2Encrypted = Buffer.from(randomBytes(32)).toString('base64');
      let callCount = 0;
      kmsMock.on(DecryptCommand).callsFake(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({
            Plaintext: new Uint8Array(
              callCount === 1 ? dekPlaintext : hmacPlaintext,
            ),
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
                dekV1Encrypted,
                dekV2Encrypted,
                hmacKeyEncrypted,
                currentVersion: 2,
              }),
            ),
            ClsModule.forRoot({ global: true }),
            RequestScopedLoggingModule,
          ],
        }).compile(),
      ).rejects.toThrow('KMS Decrypt returned empty plaintext for DEK v2');
    });

    it('should throw when currentVersion is 2 but dekV2Encrypted is not provided', async () => {
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
                dekV1Encrypted,
                dekV2Encrypted: undefined,
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
                localKey: randomBytes(32).toString('hex'),
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
