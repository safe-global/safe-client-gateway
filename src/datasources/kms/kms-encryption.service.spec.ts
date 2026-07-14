// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { IKmsService } from '@/datasources/kms/kms.service.interface';
import { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';

const configurationService = {
  getOrThrow: vi.fn(),
  get: vi.fn(),
} as MockedObject<IConfigurationService>;

const kmsService = {
  encrypt: vi.fn(),
  decrypt: vi.fn(),
} as MockedObject<IKmsService>;

/** Random `length`-byte buffer — KMS blobs and index keys are opaque here. */
function randomBytes(length: number): Buffer {
  return Buffer.from(
    faker.string.hexadecimal({
      length: length * 2,
      casing: 'lower',
      prefix: '',
    }),
    'hex',
  );
}

// 32 is INDEX_KEY_LENGTH; the two keys only need to differ to prove the token
// depends on the key.
const INDEX_KEY = randomBytes(32);
const INDEX_KEY_2 = randomBytes(32);
const WRAPPED_INDEX_KEY = Buffer.from(faker.string.alphanumeric(17));

const CONTEXT = {
  owner: faker.string.numeric(),
  field: `${faker.word.noun()}.${faker.word.noun()}`,
};

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
      const wrongLength = faker.number.int({ min: 1, max: 31 });

      await expect(
        buildTarget({ unwrapsTo: randomBytes(wrongLength) }),
      ).rejects.toThrow(`must be 32 bytes, got ${wrongLength}`);
    });

    it('does not touch KMS when nothing is configured', async () => {
      await buildTarget({ enabled: false, wrappedIndexKey: undefined });

      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('encrypt', () => {
    it('encrypts via KMS with the caller-supplied context as AAD', async () => {
      const target = await buildTarget();
      const value = faker.person.firstName();
      const blob = randomBytes(4);
      kmsService.encrypt.mockResolvedValue(blob);

      const stored = await target.encrypt(value, CONTEXT);

      expect(stored).toBe(`kms:v1:${blob.toString('base64url')}`);
      expect(kmsService.encrypt).toHaveBeenCalledExactlyOnceWith({
        plaintext: Buffer.from(value, 'utf8'),
        encryptionContext: CONTEXT,
      });
    });

    it('returns the plaintext unchanged when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });
      const value = faker.person.firstName();

      await expect(target.encrypt(value, CONTEXT)).resolves.toBe(value);
      expect(kmsService.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('decrypt', () => {
    it('decrypts kms: values with the same context', async () => {
      const target = await buildTarget();
      const value = faker.person.firstName();
      const blob = randomBytes(3);
      kmsService.decrypt.mockResolvedValue(Buffer.from(value, 'utf8'));

      const plaintext = await target.decrypt(
        `kms:v1:${blob.toString('base64url')}`,
        CONTEXT,
      );

      expect(plaintext).toBe(value);
      expect(kmsService.decrypt).toHaveBeenCalledExactlyOnceWith({
        ciphertext: blob,
        encryptionContext: CONTEXT,
      });
    });

    it('round-trips a value through encrypt then decrypt with the same context', async () => {
      const target = await buildTarget();
      const value = faker.person.firstName();
      const blob = randomBytes(3);
      kmsService.encrypt.mockResolvedValue(blob);
      kmsService.decrypt.mockResolvedValue(Buffer.from(value, 'utf8'));

      const stored = await target.encrypt(value, CONTEXT);
      const plaintext = await target.decrypt(stored, CONTEXT);

      expect(plaintext).toBe(value);
      expect(kmsService.encrypt).toHaveBeenCalledExactlyOnceWith({
        plaintext: Buffer.from(value, 'utf8'),
        encryptionContext: CONTEXT,
      });
      expect(kmsService.decrypt).toHaveBeenCalledExactlyOnceWith({
        ciphertext: blob,
        encryptionContext: CONTEXT,
      });
    });

    it('passes plaintext through unchanged when disabled', async () => {
      const target = await buildTarget({ enabled: false });
      const value = faker.person.firstName();

      await expect(target.decrypt(value, CONTEXT)).resolves.toBe(value);
      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });

    it('throws on a plaintext value when enabled', async () => {
      const target = await buildTarget();
      const value = faker.person.firstName();

      await expect(target.decrypt(value, CONTEXT)).rejects.toThrow(
        'Expected ciphertext but got a plaintext value',
      );
      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });

    it('passes the empty string through unchanged when enabled', async () => {
      const target = await buildTarget();

      await expect(target.decrypt('', CONTEXT)).resolves.toBe('');
      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });

    it('decrypts kms: values even when encryption is disabled (rollback reads)', async () => {
      const target = await buildTarget({ enabled: false });
      const value = faker.person.firstName();
      kmsService.decrypt.mockResolvedValue(Buffer.from(value, 'utf8'));

      await expect(
        target.decrypt(
          `kms:v1:${randomBytes(1).toString('base64url')}`,
          CONTEXT,
        ),
      ).resolves.toBe(value);
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
      kmsService.decrypt.mockResolvedValue(
        Buffer.from(faker.person.firstName(), 'utf8'),
      );
      const stored = `kms:v1:${randomBytes(1).toString('base64url')}`;

      await target.decrypt(stored, CONTEXT);
      await target.decrypt(stored, CONTEXT);

      expect(kmsService.decrypt).toHaveBeenCalledTimes(2);
    });
  });

  describe('blindIndex', () => {
    it('is deterministic and normalises case/whitespace', async () => {
      const target = await buildTarget();
      const raw = faker.string.hexadecimal({ length: 6, prefix: '0x' });

      expect(target.blindIndex(`  ${raw.toUpperCase()}  `)).toBe(
        target.blindIndex(raw.toLowerCase()),
      );
    });

    it('differs for different inputs and does not reveal the plaintext', async () => {
      const target = await buildTarget();
      const [value, other] = faker.helpers.uniqueArray(
        () => faker.string.alpha(8),
        2,
      );

      const token = target.blindIndex(value);
      expect(token).not.toBe(target.blindIndex(other));
      expect(token).not.toContain(value);
    });

    it('uses the index key (different key => different token)', async () => {
      const value = faker.string.hexadecimal({ prefix: '0x' });
      const withKey1 = await buildTarget({ unwrapsTo: INDEX_KEY });
      const token1 = withKey1.blindIndex(value);
      const withKey2 = await buildTarget({ unwrapsTo: INDEX_KEY_2 });

      expect(withKey2.blindIndex(value)).not.toBe(token1);
    });

    it('returns null when no index key is configured', async () => {
      const target = await buildTarget({
        enabled: false,
        wrappedIndexKey: undefined,
      });

      expect(
        target.blindIndex(faker.string.hexadecimal({ prefix: '0x' })),
      ).toBeNull();
    });
  });

  describe('isEncrypted', () => {
    it('detects the kms: prefix', async () => {
      const target = await buildTarget();

      expect(target.isEncrypted(`kms:v1:${faker.string.alphanumeric()}`)).toBe(
        true,
      );
      expect(target.isEncrypted(faker.internet.email())).toBe(false);
      expect(
        target.isEncrypted(faker.string.hexadecimal({ prefix: '0x' })),
      ).toBe(false);
    });
  });
});
