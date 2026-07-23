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
  generateDataKey: vi.fn(),
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

/**
 * Stands in for KMS GenerateDataKey + Decrypt(wrapped key): hands out copies
 * of a fixed data key (the service zeroes its copy after each use) so local
 * AES-256-GCM round-trips are real.
 */
function stubDataKey(): { dataKey: Buffer; wrappedKey: Buffer } {
  const dataKey = randomBytes(32);
  const wrappedKey = randomBytes(64);
  kmsService.generateDataKey.mockImplementation(() =>
    Promise.resolve({
      plaintextKey: Buffer.from(dataKey),
      wrappedKey: Buffer.from(wrappedKey),
    }),
  );
  kmsService.decrypt.mockImplementation(() =>
    Promise.resolve(Buffer.from(dataKey)),
  );
  return { dataKey, wrappedKey };
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
    it('envelope-encrypts via a fresh KMS data key bound to the caller-supplied context', async () => {
      const target = await buildTarget();
      const value = faker.person.firstName();
      const { wrappedKey } = stubDataKey();

      const stored = await target.encrypt(value, CONTEXT);

      expect(stored.startsWith('kms:v1:')).toBe(true);
      expect(kmsService.generateDataKey).toHaveBeenCalledExactlyOnceWith({
        encryptionContext: CONTEXT,
      });
      // The blob leads with the length-prefixed wrapped key; the value only
      // ever meets the data key locally, never KMS.
      const blob = Buffer.from(stored.slice('kms:v1:'.length), 'base64url');
      expect(blob.subarray(2, 2 + blob.readUInt16BE(0))).toStrictEqual(
        wrappedKey,
      );
      expect(kmsService.encrypt).not.toHaveBeenCalled();
    });

    it('returns the plaintext unchanged when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });
      const value = faker.person.firstName();

      await expect(target.encrypt(value, CONTEXT)).resolves.toBe(value);
      expect(kmsService.generateDataKey).not.toHaveBeenCalled();
    });
  });

  describe('decrypt', () => {
    it('round-trips a value, unwrapping the stored data key via KMS with the same context', async () => {
      const target = await buildTarget();
      const value = faker.person.firstName();
      const { wrappedKey } = stubDataKey();

      const stored = await target.encrypt(value, CONTEXT);
      const plaintext = await target.decrypt(stored, CONTEXT);

      expect(plaintext).toBe(value);
      expect(kmsService.decrypt).toHaveBeenCalledExactlyOnceWith({
        ciphertext: wrappedKey,
        encryptionContext: CONTEXT,
      });
    });

    it('round-trips values larger than the KMS direct-Encrypt limit (4096 bytes)', async () => {
      const target = await buildTarget();
      stubDataKey();
      const value = faker.string.alpha(10_000);

      const stored = await target.encrypt(value, CONTEXT);

      await expect(target.decrypt(stored, CONTEXT)).resolves.toBe(value);
    });

    it('rejects decryption under a different context, even when the data key unwraps (GCM AAD binding)', async () => {
      const target = await buildTarget();
      // The stub ignores the context, as if KMS did not enforce it — the
      // local AAD check must still reject.
      stubDataKey();
      const stored = await target.encrypt(faker.person.firstName(), CONTEXT);

      await expect(
        target.decrypt(stored, { owner: faker.string.numeric() }),
      ).rejects.toThrow();
    });

    it('rejects a tampered value (GCM authentication)', async () => {
      const target = await buildTarget();
      stubDataKey();
      const stored = await target.encrypt(faker.person.firstName(), CONTEXT);

      const blob = Buffer.from(stored.slice('kms:v1:'.length), 'base64url');
      blob[blob.length - 1] ^= 0xff;
      const tampered = `kms:v1:${blob.toString('base64url')}`;

      await expect(target.decrypt(tampered, CONTEXT)).rejects.toThrow();
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
      const encryptingTarget = await buildTarget();
      const value = faker.person.firstName();
      const { dataKey } = stubDataKey();
      const stored = await encryptingTarget.encrypt(value, CONTEXT);

      const target = await buildTarget({ enabled: false });
      // buildTarget resets the decrypt stub after init — re-stub the unwrap.
      kmsService.decrypt.mockImplementation(() =>
        Promise.resolve(Buffer.from(dataKey)),
      );

      await expect(target.decrypt(stored, CONTEXT)).resolves.toBe(value);
    });

    it('throws on malformed kms: ciphertext without touching KMS', async () => {
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
      // Envelope too short to hold a wrapped key + IV + tag.
      await expect(
        target.decrypt(
          `kms:v1:${randomBytes(8).toString('base64url')}`,
          CONTEXT,
        ),
      ).rejects.toThrow('Malformed ciphertext');
      // Declared wrapped-key length runs past the end of the blob.
      const overrun = Buffer.alloc(40);
      overrun.writeUInt16BE(500, 0);
      await expect(
        target.decrypt(`kms:v1:${overrun.toString('base64url')}`, CONTEXT),
      ).rejects.toThrow('Malformed ciphertext');
      expect(kmsService.decrypt).not.toHaveBeenCalled();
    });

    it('calls KMS on every decrypt (results are not cached)', async () => {
      const target = await buildTarget();
      stubDataKey();
      const stored = await target.encrypt(faker.person.firstName(), CONTEXT);

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
