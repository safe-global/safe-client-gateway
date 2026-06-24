// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { FieldEncryptionRegistry } from '@/datasources/encryption/field-encryption.registry';
import { FieldEncryptionService } from '@/datasources/encryption/field-encryption.service';
import type { IKmsApi } from '@/domain/interfaces/kms-api.interface';

const configurationService = {
  getOrThrow: vi.fn(),
  get: vi.fn(),
} as unknown as MockedObject<IConfigurationService>;

const kmsApi = {
  generateDataKey: vi.fn(),
  decrypt: vi.fn(),
} as unknown as MockedObject<IKmsApi>;

// A deterministic 32-byte data key the mocked KMS "unwraps" to.
const DATA_KEY = Buffer.alloc(32, 7);
const DATA_KEY_2 = Buffer.alloc(32, 9);

async function buildTarget(args: {
  enabled: boolean;
  allowLegacyPlaintext?: boolean;
  currentKeyId?: string;
  dataKeys?: Record<string, string>;
  indexKeyId?: string;
  unwrap?: (wrapped: Buffer) => Buffer;
}): Promise<FieldEncryptionService> {
  vi.resetAllMocks();

  const config: Record<string, unknown> = {
    'spaces.fieldEncryption.enabled': args.enabled,
    'spaces.fieldEncryption.allowLegacyPlaintext':
      args.allowLegacyPlaintext ?? true,
  };
  configurationService.getOrThrow.mockImplementation((key: string) => {
    if (key in config) return config[key];
    throw new Error(`Unexpected config key: ${key}`);
  });
  configurationService.get.mockImplementation((key: string) => {
    if (key === 'spaces.fieldEncryption.currentKeyId') return args.currentKeyId;
    if (key === 'spaces.fieldEncryption.dataKeys') {
      return args.dataKeys ? JSON.stringify(args.dataKeys) : undefined;
    }
    if (key === 'spaces.fieldEncryption.indexKeyId') return args.indexKeyId;
    return undefined;
  });

  const unwrap = args.unwrap ?? ((): Buffer => DATA_KEY);
  kmsApi.decrypt.mockImplementation((wrapped: Buffer) =>
    Promise.resolve(unwrap(wrapped)),
  );

  const target = new FieldEncryptionService(configurationService, kmsApi);
  await target.onModuleInit();
  return target;
}

// Default: encryption enabled with a single data key "1", also used as the
// blind-index key.
const enabledArgs = {
  enabled: true,
  currentKeyId: '1',
  indexKeyId: '1',
  dataKeys: { '1': Buffer.from('wrapped-1').toString('base64') },
};

describe('FieldEncryptionService', () => {
  afterEach(() => {
    // The service registers itself globally on init; clear it so it cannot leak
    // into other tests.
    FieldEncryptionRegistry.set(undefined);
  });

  it('registers itself for the column transformers on init', async () => {
    const target = await buildTarget(enabledArgs);

    expect(FieldEncryptionRegistry.get()).toBe(target);
  });

  describe('when enabled', () => {
    it('round-trips a value', async () => {
      const target = await buildTarget(enabledArgs);
      const plaintext = faker.lorem.words();

      const ciphertext = target.encrypt(plaintext);

      expect(target.decrypt(ciphertext)).toBe(plaintext);
    });

    it('produces a versioned, self-identifying ciphertext', async () => {
      const target = await buildTarget(enabledArgs);

      const ciphertext = target.encrypt('My Space');

      expect(ciphertext).toMatch(/^enc:v1:1:[^:]+:[^:]+:[^:]+$/);
      expect(target.isEncrypted(ciphertext)).toBe(true);
      expect(ciphertext).not.toContain('My Space');
    });

    it('produces a different ciphertext each time (random IV)', async () => {
      const target = await buildTarget(enabledArgs);
      const plaintext = 'Same value';

      const a = target.encrypt(plaintext);
      const b = target.encrypt(plaintext);

      expect(a).not.toBe(b);
      expect(target.decrypt(a)).toBe(plaintext);
      expect(target.decrypt(b)).toBe(plaintext);
    });

    it('unwraps the configured data keys via KMS on init', async () => {
      await buildTarget(enabledArgs);

      expect(kmsApi.decrypt).toHaveBeenCalledWith(Buffer.from('wrapped-1'));
    });

    it('decrypts values produced under a non-current (rotated) key', async () => {
      // A value previously encrypted under key "1".
      const old = await buildTarget(enabledArgs);
      const underKey1 = old.encrypt('legacy-key-value');
      expect(underKey1).toMatch(/^enc:v1:1:/);

      // After rotation: current key is "2" but both keys are still loaded.
      const rotated = await buildTarget({
        enabled: true,
        currentKeyId: '2',
        indexKeyId: '1',
        dataKeys: {
          '1': Buffer.from('wrapped-1').toString('base64'),
          '2': Buffer.from('wrapped-2').toString('base64'),
        },
        unwrap: (wrapped) =>
          wrapped.equals(Buffer.from('wrapped-1')) ? DATA_KEY : DATA_KEY_2,
      });

      expect(rotated.encrypt('x')).toMatch(/^enc:v1:2:/);
      expect(rotated.decrypt(underKey1)).toBe('legacy-key-value');
    });

    it('fails to decrypt when AAD differs', async () => {
      const target = await buildTarget(enabledArgs);
      const ciphertext = target.encrypt('value', 'spaces.name');

      expect(() => target.decrypt(ciphertext, 'members.name')).toThrow();
    });

    it('round-trips with matching AAD', async () => {
      const target = await buildTarget(enabledArgs);
      const ciphertext = target.encrypt('value', 'spaces.name');

      expect(target.decrypt(ciphertext, 'spaces.name')).toBe('value');
    });

    it('fails to decrypt tampered ciphertext', async () => {
      const target = await buildTarget(enabledArgs);
      const ciphertext = target.encrypt('value');
      const parts = ciphertext.split(':');
      // Corrupt the ciphertext segment.
      const corrupted = Buffer.from(parts[5], 'base64url');
      corrupted[0] ^= 0xff;
      parts[5] = corrupted.toString('base64url');

      expect(() => target.decrypt(parts.join(':'))).toThrow();
    });

    it('throws when decrypting a value referencing an unknown key id', async () => {
      const target = await buildTarget(enabledArgs);

      expect(() => target.decrypt('enc:v1:999:aa:bb:cc')).toThrow(
        /unknown.*key/i,
      );
    });

    it('throws on an unsupported ciphertext version', async () => {
      const target = await buildTarget(enabledArgs);

      expect(() => target.decrypt('enc:v2:1:aa:bb:cc')).toThrow(/version/i);
    });
  });

  describe('deterministic encryption', () => {
    it('produces identical ciphertext for the same input', async () => {
      const target = await buildTarget(enabledArgs);

      const a = target.encryptDeterministic('user@example.com');
      const b = target.encryptDeterministic('user@example.com');

      expect(a).toBe(b);
      expect(a).toMatch(/^enc:v1:1:/);
      expect(target.decrypt(a)).toBe('user@example.com');
    });

    it('produces different ciphertext for different inputs', async () => {
      const target = await buildTarget(enabledArgs);

      expect(target.encryptDeterministic('a@example.com')).not.toBe(
        target.encryptDeterministic('b@example.com'),
      );
    });

    it('is decryptable by the standard decrypt path', async () => {
      const target = await buildTarget(enabledArgs);
      const ciphertext = target.encryptDeterministic('user@example.com');

      expect(target.decrypt(ciphertext)).toBe('user@example.com');
    });

    it('binds to the AAD: same value under different AAD differs and round-trips', async () => {
      const target = await buildTarget(enabledArgs);

      const a = target.encryptDeterministic('user@example.com', 'users.email');
      const b = target.encryptDeterministic('user@example.com', 'other.field');

      expect(a).not.toBe(b);
      expect(target.decrypt(a, 'users.email')).toBe('user@example.com');
      expect(() => target.decrypt(a, 'other.field')).toThrow();
    });

    it('differs from randomized encrypt (which is non-deterministic)', async () => {
      const target = await buildTarget(enabledArgs);

      expect(target.encrypt('user@example.com')).not.toBe(
        target.encrypt('user@example.com'),
      );
      expect(target.encryptDeterministic('user@example.com')).toBe(
        target.encryptDeterministic('user@example.com'),
      );
    });

    it('is a no-op passthrough when disabled', async () => {
      const target = await buildTarget({ enabled: false });

      expect(target.encryptDeterministic('user@example.com')).toBe(
        'user@example.com',
      );
    });
  });

  describe('blindIndex', () => {
    it('is deterministic and normalises case/whitespace', async () => {
      const target = await buildTarget(enabledArgs);

      expect(target.blindIndex(' Foo@Bar.com ')).toBe(
        target.blindIndex('foo@bar.com'),
      );
    });

    it('differs for different inputs and does not reveal the plaintext', async () => {
      const target = await buildTarget(enabledArgs);

      const index = target.blindIndex('alice@example.com');
      expect(index).not.toBe(target.blindIndex('bob@example.com'));
      expect(index).not.toContain('alice');
    });

    it('uses the index key (different index key => different token)', async () => {
      const withKey1 = await buildTarget(enabledArgs);
      const withKey2 = await buildTarget({
        enabled: true,
        currentKeyId: '1',
        indexKeyId: '2',
        dataKeys: {
          '1': Buffer.from('wrapped-1').toString('base64'),
          '2': Buffer.from('wrapped-2').toString('base64'),
        },
        unwrap: (wrapped) =>
          wrapped.equals(Buffer.from('wrapped-1')) ? DATA_KEY : DATA_KEY_2,
      });

      expect(withKey1.blindIndex('a@b.com')).not.toBe(
        withKey2.blindIndex('a@b.com'),
      );
    });
  });

  describe('legacy plaintext handling', () => {
    it('returns legacy plaintext as-is when allowed', async () => {
      const target = await buildTarget({ ...enabledArgs });

      expect(target.decrypt('Legacy Name')).toBe('Legacy Name');
    });

    it('throws on legacy plaintext when not allowed', async () => {
      const target = await buildTarget({
        ...enabledArgs,
        allowLegacyPlaintext: false,
      });

      expect(() => target.decrypt('Legacy Name')).toThrow(/plaintext/i);
    });
  });

  describe('when disabled', () => {
    it('encrypt is a no-op passthrough', async () => {
      const target = await buildTarget({ enabled: false });

      expect(target.encrypt('My Space')).toBe('My Space');
      expect(target.isEncrypted('My Space')).toBe(false);
    });

    it('still decrypts existing ciphertext when data keys are configured', async () => {
      // Produce ciphertext while enabled.
      const enabled = await buildTarget(enabledArgs);
      const ciphertext = enabled.encrypt('still readable');

      // Now disabled but keys still configured (rollback safety).
      const disabled = await buildTarget({
        enabled: false,
        currentKeyId: '1',
        dataKeys: { '1': Buffer.from('wrapped-1').toString('base64') },
      });

      expect(disabled.decrypt(ciphertext)).toBe('still readable');
    });
  });

  describe('configuration validation', () => {
    it('throws on init when enabled without a current key in the data-key map', async () => {
      await expect(
        buildTarget({
          enabled: true,
          currentKeyId: 'missing',
          dataKeys: { '1': Buffer.from('wrapped-1').toString('base64') },
        }),
      ).rejects.toThrow();
    });

    it('throws on init when a key id contains the ":" delimiter', async () => {
      await expect(
        buildTarget({
          enabled: true,
          currentKeyId: 'a:b',
          indexKeyId: 'a:b',
          dataKeys: { 'a:b': Buffer.from('wrapped-1').toString('base64') },
        }),
      ).rejects.toThrow(/:/);
    });

    it('throws on init when enabled without a valid index key', async () => {
      await expect(
        buildTarget({
          enabled: true,
          currentKeyId: '1',
          // indexKeyId omitted
          dataKeys: { '1': Buffer.from('wrapped-1').toString('base64') },
        }),
      ).rejects.toThrow(/indexKeyId/);
    });
  });
});
