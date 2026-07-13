// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { IKmsService } from '@/datasources/kms/kms.service.interface';
import { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';

const configurationService = {
  getOrThrow: vi.fn(),
  get: vi.fn(),
} as unknown as MockedObject<IConfigurationService>;

const kmsService = {
  encrypt: vi.fn(),
  decrypt: vi.fn(),
} as unknown as MockedObject<IKmsService>;

const INDEX_KEY = Buffer.alloc(32, 7);
const INDEX_KEY_2 = Buffer.alloc(32, 9);
const WRAPPED_INDEX_KEY = Buffer.from('wrapped-index-key');

function stubGetOrThrow(enabled: boolean): void {
  configurationService.getOrThrow.mockImplementation((key: string) => {
    if (key === 'encryption.enabled') return enabled;
    throw new Error(`Unexpected config key: ${key}`);
  });
}

describe('KmsEncryptionService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function buildTarget(args?: {
    enabled?: boolean;
    wrappedIndexKey?: string | undefined;
    unwrapsTo?: Buffer;
    init?: boolean;
  }): Promise<KmsEncryptionService> {
    const hasIndexKeyOverride = args !== undefined && 'wrappedIndexKey' in args;
    const wrappedIndexKey = hasIndexKeyOverride
      ? args.wrappedIndexKey
      : WRAPPED_INDEX_KEY.toString('base64');

    stubGetOrThrow(args?.enabled ?? true);
    configurationService.get.mockImplementation((key: string) => {
      if (key === 'encryption.indexKey') return wrappedIndexKey;
      return undefined;
    });
    kmsService.decrypt.mockResolvedValue(args?.unwrapsTo ?? INDEX_KEY);

    const target = new KmsEncryptionService(configurationService, kmsService);
    if (args?.init !== false) {
      await target.onModuleInit();
      kmsService.decrypt.mockReset();
    }
    return target;
  }

  describe('onModuleInit', () => {
    it('unwraps the configured index key via KMS without an encryption context', async () => {
      stubGetOrThrow(true);
      configurationService.get.mockReturnValue(
        WRAPPED_INDEX_KEY.toString('base64'),
      );
      kmsService.decrypt.mockResolvedValue(INDEX_KEY);

      const target = new KmsEncryptionService(configurationService, kmsService);
      await target.onModuleInit();

      expect(kmsService.decrypt).toHaveBeenCalledExactlyOnceWith({
        ciphertext: WRAPPED_INDEX_KEY,
      });
    });

    it('unwraps the index key even when encryption is disabled (rollback safety)', async () => {
      stubGetOrThrow(false);
      configurationService.get.mockReturnValue(
        WRAPPED_INDEX_KEY.toString('base64'),
      );
      kmsService.decrypt.mockResolvedValue(INDEX_KEY);

      const target = new KmsEncryptionService(configurationService, kmsService);
      await target.onModuleInit();

      expect(kmsService.decrypt).toHaveBeenCalledOnce();
    });

    it('throws when the unwrapped index key is not 32 bytes', async () => {
      await expect(
        buildTarget({ unwrapsTo: Buffer.alloc(16, 1) }),
      ).rejects.toThrow('must be 32 bytes, got 16');
    });

    it('does not touch KMS when nothing is configured', async () => {
      await buildTarget({ enabled: false, wrappedIndexKey: undefined });

      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });
  });

  const CONTEXT = { owner: '1', field: 'x.y' };

  describe('encrypt', () => {
    it('encrypts via KMS with the caller-supplied context as AAD', async () => {
      const target = await buildTarget();
      kmsService.encrypt.mockResolvedValue(Buffer.from([1, 2, 3, 4]));

      const stored = await target.encrypt('Alice', CONTEXT);

      expect(stored).toBe(
        `kms:v1:${Buffer.from([1, 2, 3, 4]).toString('base64url')}`,
      );
      expect(kmsService.encrypt).toHaveBeenCalledExactlyOnceWith({
        plaintext: Buffer.from('Alice', 'utf8'),
        encryptionContext: CONTEXT,
      });
    });

    it('returns the plaintext unchanged when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });

      await expect(target.encrypt('Alice', CONTEXT)).resolves.toBe('Alice');
      expect(kmsService.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('decrypt', () => {
    it('decrypts kms: values with the same context', async () => {
      const target = await buildTarget();
      const blob = Buffer.from([9, 9, 9]);
      kmsService.decrypt.mockResolvedValue(Buffer.from('Alice', 'utf8'));

      const plaintext = await target.decrypt(
        `kms:v1:${blob.toString('base64url')}`,
        CONTEXT,
      );

      expect(plaintext).toBe('Alice');
      expect(kmsService.decrypt).toHaveBeenCalledExactlyOnceWith({
        ciphertext: blob,
        encryptionContext: CONTEXT,
      });
    });

    it('round-trips a value through encrypt then decrypt with the same context', async () => {
      const target = await buildTarget();
      const blob = Buffer.from([5, 6, 7]);
      kmsService.encrypt.mockResolvedValue(blob);
      kmsService.decrypt.mockResolvedValue(Buffer.from('Alice', 'utf8'));

      const stored = await target.encrypt('Alice', CONTEXT);
      const plaintext = await target.decrypt(stored, CONTEXT);

      expect(plaintext).toBe('Alice');
      expect(kmsService.encrypt).toHaveBeenCalledExactlyOnceWith({
        plaintext: Buffer.from('Alice', 'utf8'),
        encryptionContext: CONTEXT,
      });
      expect(kmsService.decrypt).toHaveBeenCalledExactlyOnceWith({
        ciphertext: blob,
        encryptionContext: CONTEXT,
      });
    });

    it('passes plaintext through unchanged when disabled (backfill window)', async () => {
      const target = await buildTarget({ enabled: false });

      await expect(target.decrypt('Alice', CONTEXT)).resolves.toBe('Alice');
      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });

    it('passes plaintext through unchanged when enabled (backfill window)', async () => {
      const target = await buildTarget();

      await expect(target.decrypt('Alice', CONTEXT)).resolves.toBe('Alice');
      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });

    it('decrypts kms: values even when encryption is disabled (rollback reads)', async () => {
      const target = await buildTarget({ enabled: false });
      kmsService.decrypt.mockResolvedValue(Buffer.from('Alice', 'utf8'));

      await expect(
        target.decrypt(
          `kms:v1:${Buffer.from('x').toString('base64url')}`,
          CONTEXT,
        ),
      ).resolves.toBe('Alice');
    });

    it('throws on malformed kms: ciphertext', async () => {
      const target = await buildTarget();

      await expect(target.decrypt('kms:v2:x', CONTEXT)).rejects.toThrow(
        'Malformed ciphertext',
      );
      await expect(target.decrypt('kms:v1:', CONTEXT)).rejects.toThrow(
        'Malformed ciphertext',
      );
      await expect(target.decrypt('kms:v1:a:b', CONTEXT)).rejects.toThrow(
        'Malformed ciphertext',
      );
    });

    it('calls KMS on every decrypt (results are not cached)', async () => {
      const target = await buildTarget();
      kmsService.decrypt.mockResolvedValue(Buffer.from('Alice', 'utf8'));
      const stored = `kms:v1:${Buffer.from([1]).toString('base64url')}`;

      await target.decrypt(stored, CONTEXT);
      await target.decrypt(stored, CONTEXT);

      expect(kmsService.decrypt).toHaveBeenCalledTimes(2);
    });
  });

  describe('blindIndex', () => {
    it('is deterministic and normalises case/whitespace', async () => {
      const target = await buildTarget();

      expect(target.blindIndex(' 0xAbC ')).toBe(target.blindIndex('0xabc'));
    });

    it('differs for different inputs and does not reveal the plaintext', async () => {
      const target = await buildTarget();

      const token = target.blindIndex('alice');
      expect(token).not.toBe(target.blindIndex('bob'));
      expect(token).not.toContain('alice');
    });

    it('uses the index key (different key => different token)', async () => {
      const withKey1 = await buildTarget({ unwrapsTo: INDEX_KEY });
      const token1 = withKey1.blindIndex('0xabc');
      const withKey2 = await buildTarget({ unwrapsTo: INDEX_KEY_2 });

      expect(withKey2.blindIndex('0xabc')).not.toBe(token1);
    });

    it('returns null when no index key is configured', async () => {
      const target = await buildTarget({
        enabled: false,
        wrappedIndexKey: undefined,
      });

      expect(target.blindIndex('0xabc')).toBeNull();
    });
  });

  describe('isEncrypted', () => {
    it('detects the kms: prefix', async () => {
      const target = await buildTarget();

      expect(target.isEncrypted('kms:v1:abc')).toBe(true);
      expect(target.isEncrypted('alice@example.com')).toBe(false);
      expect(target.isEncrypted('0xabc')).toBe(false);
    });
  });
});
