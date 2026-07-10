// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { FieldCryptoService } from '@/datasources/kms/field-crypto.service';
import type { IKmsService } from '@/datasources/kms/kms.service.interface';

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

describe('FieldCryptoService', () => {
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
  }): Promise<FieldCryptoService> {
    const hasIndexKeyOverride = args !== undefined && 'wrappedIndexKey' in args;
    const wrappedIndexKey = hasIndexKeyOverride
      ? args.wrappedIndexKey
      : WRAPPED_INDEX_KEY.toString('base64');

    configurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'spaces.fieldEncryption.enabled')
        return args?.enabled ?? true;
      throw new Error(`Unexpected config key: ${key}`);
    });
    configurationService.get.mockImplementation((key: string) => {
      if (key === 'spaces.fieldEncryption.indexKey') return wrappedIndexKey;
      return undefined;
    });
    kmsService.decrypt.mockResolvedValue(args?.unwrapsTo ?? INDEX_KEY);

    const target = new FieldCryptoService(configurationService, kmsService);
    if (args?.init !== false) {
      await target.onModuleInit();
      kmsService.decrypt.mockReset();
    }
    return target;
  }

  describe('onModuleInit', () => {
    it('unwraps the configured index key via KMS without an encryption context', async () => {
      configurationService.getOrThrow.mockReturnValue(true);
      configurationService.get.mockReturnValue(
        WRAPPED_INDEX_KEY.toString('base64'),
      );
      kmsService.decrypt.mockResolvedValue(INDEX_KEY);

      const target = new FieldCryptoService(configurationService, kmsService);
      await target.onModuleInit();

      expect(kmsService.decrypt).toHaveBeenCalledExactlyOnceWith({
        ciphertext: WRAPPED_INDEX_KEY,
      });
    });

    it('unwraps the index key even when encryption is disabled (rollback safety)', async () => {
      configurationService.getOrThrow.mockReturnValue(false);
      configurationService.get.mockReturnValue(
        WRAPPED_INDEX_KEY.toString('base64'),
      );
      kmsService.decrypt.mockResolvedValue(INDEX_KEY);

      const target = new FieldCryptoService(configurationService, kmsService);
      await target.onModuleInit();

      expect(kmsService.decrypt).toHaveBeenCalledOnce();
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

    it('does not touch KMS when nothing is configured', async () => {
      await buildTarget({ enabled: false, wrappedIndexKey: undefined });

      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('encrypt', () => {
    it('binds the field and a userId scope into the encryption context', async () => {
      const target = await buildTarget();
      kmsService.encrypt.mockResolvedValue(Buffer.from([1, 2, 3, 4]));

      const stored = await target.encrypt(
        'wallets.address',
        { userId: 42 },
        '0xAbC1000000000000000000000000000000000001',
      );

      expect(stored).toBe(
        `kms:v1:${Buffer.from([1, 2, 3, 4]).toString('base64url')}`,
      );
      expect(kmsService.encrypt).toHaveBeenCalledExactlyOnceWith({
        plaintext: Buffer.from(
          '0xAbC1000000000000000000000000000000000001',
          'utf8',
        ),
        encryptionContext: { userId: '42', field: 'wallets.address' },
      });
    });

    it('binds a spaceId scope into the encryption context', async () => {
      const target = await buildTarget();
      kmsService.encrypt.mockResolvedValue(Buffer.from([9]));

      await target.encrypt('members.name', { spaceId: 7 }, 'Alice');

      expect(kmsService.encrypt).toHaveBeenCalledExactlyOnceWith({
        plaintext: Buffer.from('Alice', 'utf8'),
        encryptionContext: { spaceId: '7', field: 'members.name' },
      });
    });

    it('returns the plaintext unchanged when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });

      await expect(
        target.encrypt('members.name', { spaceId: 7 }, 'Alice'),
      ).resolves.toBe('Alice');
      expect(kmsService.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('decrypt', () => {
    it('decrypts kms: values with the same field-and-scope context', async () => {
      const target = await buildTarget();
      const blob = Buffer.from([9, 9, 9]);
      kmsService.decrypt.mockResolvedValue(Buffer.from('Alice', 'utf8'));

      const plaintext = await target.decrypt(
        'members.name',
        { spaceId: 7 },
        `kms:v1:${blob.toString('base64url')}`,
      );

      expect(plaintext).toBe('Alice');
      expect(kmsService.decrypt).toHaveBeenCalledExactlyOnceWith({
        ciphertext: blob,
        encryptionContext: { spaceId: '7', field: 'members.name' },
      });
    });

    it('passes plaintext through unchanged (backfill window)', async () => {
      const target = await buildTarget();

      await expect(
        target.decrypt('members.name', { spaceId: 7 }, 'Alice'),
      ).resolves.toBe('Alice');
      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });

    it('decrypts kms: values even when encryption is disabled (rollback reads)', async () => {
      const target = await buildTarget({ enabled: false });
      kmsService.decrypt.mockResolvedValue(Buffer.from('Alice', 'utf8'));

      await expect(
        target.decrypt(
          'members.name',
          { spaceId: 7 },
          `kms:v1:${Buffer.from('x').toString('base64url')}`,
        ),
      ).resolves.toBe('Alice');
    });

    it('throws on malformed kms: ciphertext', async () => {
      const target = await buildTarget();

      await expect(
        target.decrypt('members.name', { spaceId: 7 }, 'kms:v2:abc'),
      ).rejects.toThrow('Malformed ciphertext');
      await expect(
        target.decrypt('members.name', { spaceId: 7 }, 'kms:v1:'),
      ).rejects.toThrow('Malformed ciphertext');
    });

    it('serves repeated decrypts of the same ciphertext from the cache', async () => {
      const target = await buildTarget();
      kmsService.decrypt.mockResolvedValue(Buffer.from('Alice', 'utf8'));
      const stored = `kms:v1:${Buffer.from([1]).toString('base64url')}`;

      await target.decrypt('members.name', { spaceId: 7 }, stored);
      await target.decrypt('members.name', { spaceId: 7 }, stored);

      expect(kmsService.decrypt).toHaveBeenCalledOnce();
    });

    it('re-decrypts after the cache TTL elapses', async () => {
      const target = await buildTarget();
      kmsService.decrypt.mockResolvedValue(Buffer.from('Alice', 'utf8'));
      const stored = `kms:v1:${Buffer.from([1]).toString('base64url')}`;

      await target.decrypt('members.name', { spaceId: 7 }, stored);
      vi.advanceTimersByTime(5 * 60 * 1_000 + 1);
      await target.decrypt('members.name', { spaceId: 7 }, stored);

      expect(kmsService.decrypt).toHaveBeenCalledTimes(2);
    });
  });

  describe('blindIndex', () => {
    it('is deterministic and normalises case/whitespace', async () => {
      const target = await buildTarget();

      expect(target.blindIndex('wallets.address', ' 0xAbC ')).toBe(
        target.blindIndex('wallets.address', '0xabc'),
      );
    });

    it('domain-separates by field: same value, different field, different token', async () => {
      const target = await buildTarget();

      expect(target.blindIndex('wallets.address', '0xabc')).not.toBe(
        target.blindIndex('space_safes.address', '0xabc'),
      );
    });

    it('differs for different inputs and does not reveal the plaintext', async () => {
      const target = await buildTarget();

      const token = target.blindIndex('members.name', 'alice');
      expect(token).not.toBe(target.blindIndex('members.name', 'bob'));
      expect(token).not.toContain('alice');
    });

    it('uses the index key (different key => different token)', async () => {
      const withKey1 = await buildTarget({ unwrapsTo: INDEX_KEY });
      const token1 = withKey1.blindIndex('wallets.address', '0xabc');
      const withKey2 = await buildTarget({ unwrapsTo: INDEX_KEY_2 });

      expect(withKey2.blindIndex('wallets.address', '0xabc')).not.toBe(token1);
    });

    it('returns null when no index key is configured', async () => {
      const target = await buildTarget({
        enabled: false,
        wrappedIndexKey: undefined,
      });

      expect(target.blindIndex('wallets.address', '0xabc')).toBeNull();
    });
  });

  describe('emailBlindIndex', () => {
    it('omits the field segment (users.email on-disk contract)', async () => {
      const target = await buildTarget();

      const legacy = target.emailBlindIndex('a@b.com');
      expect(legacy).not.toBeNull();
      expect(legacy).not.toBe(target.blindIndex('users.email', 'a@b.com'));
    });

    it('normalises and returns null without a key, like blindIndex', async () => {
      const target = await buildTarget();
      expect(target.emailBlindIndex(' A@B.com ')).toBe(
        target.emailBlindIndex('a@b.com'),
      );

      const withoutKey = await buildTarget({
        enabled: false,
        wrappedIndexKey: undefined,
      });
      expect(withoutKey.emailBlindIndex('a@b.com')).toBeNull();
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
