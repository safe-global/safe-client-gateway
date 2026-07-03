// SPDX-License-Identifier: FSL-1.1-MIT

import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { KmsService } from '@/datasources/kms/kms.service';
import { EmailEncryptionService } from '@/modules/users/domain/email-encryption.service';

const configurationService = {
  getOrThrow: vi.fn(),
  get: vi.fn(),
} as unknown as MockedObject<IConfigurationService>;

const kmsService = {
  encrypt: vi.fn(),
  decrypt: vi.fn(),
} as unknown as MockedObject<KmsService>;

// A deterministic 32-byte blind-index key the mocked KMS "unwraps" to.
const INDEX_KEY = Buffer.alloc(32, 7);
const INDEX_KEY_2 = Buffer.alloc(32, 9);
const WRAPPED_INDEX_KEY = Buffer.from('wrapped-index-key');

describe('EmailEncryptionService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Builds an EmailEncryptionService against mocked config + mocked
   * KmsService and (by default) runs onModuleInit, during which the mocked
   * KMS "unwraps" the configured index key to `unwrapsTo` (default:
   * INDEX_KEY).
   */
  async function buildTarget(args?: {
    enabled?: boolean;
    wrappedIndexKey?: string | undefined;
    unwrapsTo?: Buffer;
  }): Promise<EmailEncryptionService> {
    const hasIndexKeyOverride = args !== undefined && 'wrappedIndexKey' in args;
    const wrappedIndexKey = hasIndexKeyOverride
      ? args.wrappedIndexKey
      : WRAPPED_INDEX_KEY.toString('base64');

    configurationService.getOrThrow.mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        'spaces.fieldEncryption.enabled': args?.enabled ?? true,
      };
      if (key in values) return values[key];
      throw new Error(`Unexpected config key: ${key}`);
    });
    configurationService.get.mockImplementation((key: string) => {
      if (key === 'spaces.fieldEncryption.indexKey') return wrappedIndexKey;
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
        buildTarget({ enabled: true, wrappedIndexKey: undefined }),
      ).rejects.toThrow('spaces.fieldEncryption.indexKey is required');
    });

    it('throws when the unwrapped index key is not 32 bytes', async () => {
      await expect(
        buildTarget({ unwrapsTo: Buffer.alloc(16, 1) }),
      ).rejects.toThrow('must be 32 bytes, got 16');
    });

    it('does not call KMS when no index key is configured (disabled default)', async () => {
      await buildTarget({ enabled: false, wrappedIndexKey: undefined });

      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('blindIndex', () => {
    it('is deterministic and normalises case/whitespace', async () => {
      const target = await buildTarget();

      expect(target.blindIndex(' Foo@Bar.com ')).toBe(
        target.blindIndex('foo@bar.com'),
      );
    });

    it('differs for different inputs and does not reveal the plaintext', async () => {
      const target = await buildTarget();

      const index = target.blindIndex('alice@example.com');
      expect(index).not.toBe(target.blindIndex('bob@example.com'));
      expect(index).not.toContain('alice');
    });

    it('uses the index key (different key => different token)', async () => {
      const withKey1 = await buildTarget({ unwrapsTo: INDEX_KEY });
      const token1 = withKey1.blindIndex('a@b.com');
      const withKey2 = await buildTarget({ unwrapsTo: INDEX_KEY_2 });

      expect(withKey2.blindIndex('a@b.com')).not.toBe(token1);
    });

    it('returns null when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });

      expect(target.blindIndex('a@b.com')).toBeNull();
    });
  });

  describe('encrypt', () => {
    it('encrypts via KMS bound to the user and field, and formats as kms:v1', async () => {
      const target = await buildTarget();
      const ciphertext = Buffer.from([1, 2, 3, 4]);
      kmsService.encrypt.mockResolvedValue(ciphertext);

      const stored = await target.encrypt(42, 'alice@example.com');

      expect(stored).toBe(`kms:v1:${ciphertext.toString('base64url')}`);
      expect(kmsService.encrypt).toHaveBeenCalledExactlyOnceWith({
        plaintext: Buffer.from('alice@example.com', 'utf8'),
        encryptionContext: { userId: '42', field: 'users.email' },
      });
    });

    it('returns the plaintext unchanged when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });

      await expect(target.encrypt(42, 'alice@example.com')).resolves.toBe(
        'alice@example.com',
      );
      expect(kmsService.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('decrypt', () => {
    it('decrypts kms: values via KMS with the same encryption context', async () => {
      const target = await buildTarget();
      const blob = Buffer.from([9, 9, 9]);
      kmsService.decrypt.mockResolvedValue(
        Buffer.from('alice@example.com', 'utf8'),
      );

      const plaintext = await target.decrypt(
        42,
        `kms:v1:${blob.toString('base64url')}`,
      );

      expect(plaintext).toBe('alice@example.com');
      // First decrypt call was the index-key unwrap during init.
      expect(kmsService.decrypt).toHaveBeenCalledTimes(2);
      expect(kmsService.decrypt).toHaveBeenLastCalledWith({
        ciphertext: blob,
        encryptionContext: { userId: '42', field: 'users.email' },
      });
    });

    it('decrypts kms: values even when encryption is disabled (rollback reads)', async () => {
      const target = await buildTarget({ enabled: false });
      kmsService.decrypt.mockResolvedValue(Buffer.from('a@b.com', 'utf8'));

      await expect(
        target.decrypt(7, `kms:v1:${Buffer.from('x').toString('base64url')}`),
      ).resolves.toBe('a@b.com');
    });

    it('throws on plaintext when encryption is enabled', async () => {
      const target = await buildTarget({ enabled: true });

      await expect(target.decrypt(42, 'plain@example.com')).rejects.toThrow(
        'unencrypted',
      );
    });

    it('passes plaintext through when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });

      await expect(target.decrypt(42, 'plain@example.com')).resolves.toBe(
        'plain@example.com',
      );
      expect(kmsService.decrypt).toHaveBeenCalledTimes(1); // init only
    });

    it('throws on malformed kms: ciphertext', async () => {
      const target = await buildTarget();

      await expect(target.decrypt(42, 'kms:v2:abc')).rejects.toThrow(
        'Malformed ciphertext',
      );
      await expect(target.decrypt(42, 'kms:v1:')).rejects.toThrow(
        'Malformed ciphertext',
      );
    });
  });

  describe('isEncrypted', () => {
    it('detects the kms: prefix', async () => {
      const target = await buildTarget();

      expect(target.isEncrypted('kms:v1:abc')).toBe(true);
      expect(target.isEncrypted('alice@example.com')).toBe(false);
    });
  });

  describe('decryptUserEmails', () => {
    it('decrypts encrypted emails in place, bound to each owning user', async () => {
      const target = await buildTarget();
      kmsService.decrypt
        .mockResolvedValueOnce(Buffer.from('alice@example.com', 'utf8'))
        .mockResolvedValueOnce(Buffer.from('bob@example.com', 'utf8'));
      const aliceBlob = Buffer.from('alice-ct');
      const bobBlob = Buffer.from('bob-ct');
      const users = [
        { id: 1, email: `kms:v1:${aliceBlob.toString('base64url')}` },
        { id: 2, email: `kms:v1:${bobBlob.toString('base64url')}` },
      ];

      await target.decryptUserEmails(users);

      expect(users[0].email).toBe('alice@example.com');
      expect(users[1].email).toBe('bob@example.com');
      // First decrypt call was the index-key unwrap during init.
      expect(kmsService.decrypt).toHaveBeenCalledTimes(3);
      expect(kmsService.decrypt).toHaveBeenNthCalledWith(2, {
        ciphertext: aliceBlob,
        encryptionContext: { userId: '1', field: 'users.email' },
      });
      expect(kmsService.decrypt).toHaveBeenNthCalledWith(3, {
        ciphertext: bobBlob,
        encryptionContext: { userId: '2', field: 'users.email' },
      });
    });

    it('throws on a plaintext email when encryption is enabled', async () => {
      const target = await buildTarget({ enabled: true });

      await expect(
        target.decryptUserEmails([{ id: 1, email: 'plain@example.com' }]),
      ).rejects.toThrow('unencrypted');
    });

    it('leaves plaintext and null emails untouched when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });
      const users = [
        { id: 1, email: 'plain@example.com' },
        { id: 2, email: null },
      ];

      await target.decryptUserEmails(users);

      expect(users[0].email).toBe('plain@example.com');
      expect(users[1].email).toBeNull();
      expect(kmsService.decrypt).toHaveBeenCalledTimes(1); // init only
    });
  });
});
