// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { IKmsService } from '@/datasources/kms/kms.service.interface';
import { EmailEncryptionService } from '@/modules/users/domain/email-encryption.service';

const configurationService = {
  getOrThrow: vi.fn(),
  get: vi.fn(),
} as MockedObject<IConfigurationService>;

const kmsService = {
  encrypt: vi.fn(),
  decrypt: vi.fn(),
} as MockedObject<IKmsService>;

// A deterministic 32-byte blind-index key the mocked KMS "unwraps" to.
const INDEX_KEY = Buffer.alloc(32, 7);
const INDEX_KEY_2 = Buffer.alloc(32, 9);
const WRAPPED_INDEX_KEY = Buffer.from(faker.string.alphanumeric(24));

describe('EmailEncryptionService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Builds an EmailEncryptionService against mocked config + mocked
   * IKmsService and (by default) runs onModuleInit, during which the mocked
   * KMS "unwraps" the configured index key to `unwrapsTo` (default:
   * INDEX_KEY).
   */
  async function buildTarget(args?: {
    enabled?: boolean;
    wrappedEmailIndexKey?: string | undefined;
    unwrapsTo?: Buffer;
  }): Promise<EmailEncryptionService> {
    const hasIndexKeyOverride =
      args !== undefined && 'wrappedEmailIndexKey' in args;
    const wrappedEmailIndexKey = hasIndexKeyOverride
      ? args.wrappedEmailIndexKey
      : WRAPPED_INDEX_KEY.toString('base64');

    configurationService.getOrThrow.mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        'spaces.fieldEncryption.enabled': args?.enabled ?? true,
      };
      if (key in values) return values[key];
      throw new Error(`Unexpected config key: ${key}`);
    });
    configurationService.get.mockImplementation((key: string) => {
      if (key === 'spaces.fieldEncryption.emailIndexKey') {
        return wrappedEmailIndexKey;
      }
      return undefined;
    });

    kmsService.decrypt.mockResolvedValue(args?.unwrapsTo ?? INDEX_KEY);

    const target = new EmailEncryptionService(configurationService, kmsService);
    await target.onModuleInit();
    return target;
  }

  describe('onModuleInit', () => {
    it('unwraps the configured index key via KMS without an encryption context', async () => {
      await buildTarget();

      expect(kmsService.decrypt).toHaveBeenCalledExactlyOnceWith({
        ciphertext: WRAPPED_INDEX_KEY,
      });
    });

    it('unwraps the index key even when encryption is disabled (rollback safety)', async () => {
      await buildTarget({ enabled: false });

      expect(kmsService.decrypt).toHaveBeenCalledTimes(1);
    });

    it('throws when enabled without a configured index key', async () => {
      await expect(
        buildTarget({ enabled: true, wrappedEmailIndexKey: undefined }),
      ).rejects.toThrow('spaces.fieldEncryption.emailIndexKey is required');
    });

    it('throws when the unwrapped index key is not 32 bytes', async () => {
      await expect(
        buildTarget({ unwrapsTo: Buffer.alloc(16, 1) }),
      ).rejects.toThrow('must be 32 bytes, got 16');
    });

    it('does not call KMS when no index key is configured (disabled default)', async () => {
      await buildTarget({ enabled: false, wrappedEmailIndexKey: undefined });

      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('blindIndex', () => {
    it('is deterministic and normalises case/whitespace', async () => {
      const target = await buildTarget();
      const email = faker.internet.email().toLowerCase();

      expect(target.blindIndex(` ${email.toUpperCase()} `)).toBe(
        target.blindIndex(email),
      );
    });

    it('differs for different inputs and does not reveal the plaintext', async () => {
      const target = await buildTarget();
      const [localPart, domain] = ['alice', faker.internet.domainName()];
      const email = `${localPart}@${domain}`;

      const index = target.blindIndex(email);
      expect(index).not.toBe(target.blindIndex(`bob@${domain}`));
      expect(index).not.toContain(localPart);
    });

    it('uses the index key (different key => different token)', async () => {
      const email = faker.internet.email();
      const withKey1 = await buildTarget({ unwrapsTo: INDEX_KEY });
      const token1 = withKey1.blindIndex(email);
      const withKey2 = await buildTarget({ unwrapsTo: INDEX_KEY_2 });

      expect(withKey2.blindIndex(email)).not.toBe(token1);
    });

    it('still computes the index when disabled but a key is configured, so lookups keep matching rows written before a rollback', async () => {
      const enabled = await buildTarget({ enabled: true });
      const disabled = await buildTarget({ enabled: false });
      const email = faker.internet.email();

      expect(disabled.blindIndex(email)).not.toBeNull();
      expect(disabled.blindIndex(email)).toBe(enabled.blindIndex(email));
    });

    it('returns null when no index key is configured', async () => {
      const target = await buildTarget({
        enabled: false,
        wrappedEmailIndexKey: undefined,
      });

      expect(target.blindIndex(faker.internet.email())).toBeNull();
    });
  });

  describe('encrypt', () => {
    it('encrypts via KMS bound to the user and field, and formats as kms:v1', async () => {
      const target = await buildTarget();
      const userId = faker.number.int({ min: 1, max: 10_000 });
      const email = faker.internet.email();
      const ciphertext = Buffer.from([1, 2, 3, 4]);
      kmsService.encrypt.mockResolvedValue(ciphertext);

      const stored = await target.encrypt(userId, email);

      expect(stored).toBe(`kms:v1:${ciphertext.toString('base64url')}`);
      expect(kmsService.encrypt).toHaveBeenCalledExactlyOnceWith({
        plaintext: Buffer.from(email, 'utf8'),
        encryptionContext: { userId: String(userId), field: 'users.email' },
      });
    });

    it('returns the plaintext unchanged when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });
      const userId = faker.number.int({ min: 1, max: 10_000 });
      const email = faker.internet.email();

      await expect(target.encrypt(userId, email)).resolves.toBe(email);
      expect(kmsService.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('decrypt', () => {
    it('decrypts kms: values via KMS with the same encryption context', async () => {
      const target = await buildTarget();
      const userId = faker.number.int({ min: 1, max: 10_000 });
      const email = faker.internet.email();
      const blob = Buffer.from([9, 9, 9]);
      kmsService.decrypt.mockResolvedValue(Buffer.from(email, 'utf8'));

      const plaintext = await target.decrypt(
        userId,
        `kms:v1:${blob.toString('base64url')}`,
      );

      expect(plaintext).toBe(email);
      // First decrypt call was the index-key unwrap during init.
      expect(kmsService.decrypt).toHaveBeenCalledTimes(2);
      expect(kmsService.decrypt).toHaveBeenLastCalledWith({
        ciphertext: blob,
        encryptionContext: { userId: String(userId), field: 'users.email' },
      });
    });

    it('decrypts kms: values even when encryption is disabled (rollback reads)', async () => {
      const target = await buildTarget({ enabled: false });
      const email = faker.internet.email();
      kmsService.decrypt.mockResolvedValue(Buffer.from(email, 'utf8'));

      await expect(
        target.decrypt(
          faker.number.int({ min: 1, max: 10_000 }),
          `kms:v1:${Buffer.from('x').toString('base64url')}`,
        ),
      ).resolves.toBe(email);
    });

    it('passes plaintext through when encryption is enabled (backfill in progress)', async () => {
      const target = await buildTarget({ enabled: true });
      const email = faker.internet.email();

      await expect(
        target.decrypt(faker.number.int({ min: 1, max: 10_000 }), email),
      ).resolves.toBe(email);
    });

    it('passes plaintext through when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });
      const email = faker.internet.email();

      await expect(
        target.decrypt(faker.number.int({ min: 1, max: 10_000 }), email),
      ).resolves.toBe(email);
      expect(kmsService.decrypt).toHaveBeenCalledTimes(1); // init only
    });

    it('throws on malformed kms: ciphertext', async () => {
      const target = await buildTarget();
      const userId = faker.number.int({ min: 1, max: 10_000 });

      await expect(target.decrypt(userId, 'kms:v2:abc')).rejects.toThrow(
        'Malformed ciphertext',
      );
      await expect(target.decrypt(userId, 'kms:v1:')).rejects.toThrow(
        'Malformed ciphertext',
      );
    });
  });

  describe('isEncrypted', () => {
    it('detects the kms: prefix', async () => {
      const target = await buildTarget();

      expect(target.isEncrypted('kms:v1:abc')).toBe(true);
      expect(target.isEncrypted(faker.internet.email())).toBe(false);
    });
  });

  describe('decryptUserEmails', () => {
    it('returns copies with decrypted emails, bound to each owning user, leaving the input untouched', async () => {
      const target = await buildTarget();
      const emailA = faker.internet.email();
      const emailB = faker.internet.email();
      kmsService.decrypt
        .mockResolvedValueOnce(Buffer.from(emailA, 'utf8'))
        .mockResolvedValueOnce(Buffer.from(emailB, 'utf8'));
      const blobA = Buffer.from(faker.string.alphanumeric(12));
      const blobB = Buffer.from(faker.string.alphanumeric(12));
      const storedA = `kms:v1:${blobA.toString('base64url')}`;
      const storedB = `kms:v1:${blobB.toString('base64url')}`;
      const users = [
        { id: 1, email: storedA },
        { id: 2, email: storedB },
      ];

      const decrypted = await target.decryptUserEmails(users);

      expect(decrypted[0]).toStrictEqual({ id: 1, email: emailA });
      expect(decrypted[1]).toStrictEqual({ id: 2, email: emailB });
      // The input rows keep their stored (encrypted) values.
      expect(users[0].email).toBe(storedA);
      expect(users[1].email).toBe(storedB);
      // First decrypt call was the index-key unwrap during init.
      expect(kmsService.decrypt).toHaveBeenCalledTimes(3);
      expect(kmsService.decrypt).toHaveBeenNthCalledWith(2, {
        ciphertext: blobA,
        encryptionContext: { userId: '1', field: 'users.email' },
      });
      expect(kmsService.decrypt).toHaveBeenNthCalledWith(3, {
        ciphertext: blobB,
        encryptionContext: { userId: '2', field: 'users.email' },
      });
    });

    it('passes a plaintext email through when encryption is enabled (backfill in progress)', async () => {
      const target = await buildTarget({ enabled: true });
      const email = faker.internet.email();

      const decrypted = await target.decryptUserEmails([{ id: 1, email }]);

      expect(decrypted[0].email).toBe(email);
    });

    it('returns plaintext and null emails untouched when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });
      const email = faker.internet.email();
      const users = [
        { id: 1, email },
        { id: 2, email: null },
      ];

      const decrypted = await target.decryptUserEmails(users);

      expect(decrypted[0].email).toBe(email);
      expect(decrypted[1].email).toBeNull();
      expect(kmsService.decrypt).toHaveBeenCalledTimes(1); // init only
    });
  });
});
