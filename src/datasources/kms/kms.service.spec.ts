// SPDX-License-Identifier: FSL-1.1-MIT

import {
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { mockClient } from 'aws-sdk-client-mock';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { KmsService } from '@/datasources/kms/kms.service';

const configurationService = {
  getOrThrow: vi.fn(),
  get: vi.fn(),
} as unknown as MockedObject<IConfigurationService>;

// A deterministic 32-byte blind-index key the mocked KMS "unwraps" to.
const INDEX_KEY = Buffer.alloc(32, 7);
const INDEX_KEY_2 = Buffer.alloc(32, 9);
const WRAPPED_INDEX_KEY = Buffer.from('wrapped-index-key');

const keyId = 'kms-key-arn';
const region = 'eu-central-1';

describe('KmsService', () => {
  const kmsMock = mockClient(KMSClient);

  beforeEach(() => {
    vi.resetAllMocks();
    kmsMock.reset();
  });

  /**
   * Builds a KmsService against mocked config + mocked KMS and (by default)
   * runs onModuleInit, during which the mocked KMS Decrypt "unwraps" the
   * configured index key to `unwrapsTo` (default: INDEX_KEY).
   */
  async function buildTarget(args?: {
    enabled?: boolean;
    allowLegacyPlaintext?: boolean;
    wrappedIndexKey?: string | undefined;
    webIdentityTokenFile?: string;
    unwrapsTo?: Buffer;
    init?: boolean;
  }): Promise<KmsService> {
    const hasIndexKeyOverride = args !== undefined && 'wrappedIndexKey' in args;
    const wrappedIndexKey = hasIndexKeyOverride
      ? args.wrappedIndexKey
      : WRAPPED_INDEX_KEY.toString('base64');

    configurationService.getOrThrow.mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        'spaces.fieldEncryption.enabled': args?.enabled ?? true,
        'spaces.fieldEncryption.allowLegacyPlaintext':
          args?.allowLegacyPlaintext ?? true,
        'spaces.fieldEncryption.kms.keyId': keyId,
        'spaces.fieldEncryption.kms.region': region,
        'spaces.fieldEncryption.kms.accessKeyId': 'access-key-id',
        'spaces.fieldEncryption.kms.secretAccessKey': 'secret-access-key',
      };
      if (key in values) return values[key];
      throw new Error(`Unexpected config key: ${key}`);
    });
    configurationService.get.mockImplementation((key: string) => {
      if (key === 'spaces.fieldEncryption.indexKey') return wrappedIndexKey;
      if (key === 'spaces.fieldEncryption.kms.webIdentityTokenFile') {
        return args?.webIdentityTokenFile;
      }
      return undefined;
    });

    kmsMock.on(DecryptCommand).resolves({
      Plaintext: new Uint8Array(args?.unwrapsTo ?? INDEX_KEY),
    });

    const target = new KmsService(configurationService);
    if (args?.init !== false) {
      await target.onModuleInit();
    }
    return target;
  }

  describe('onModuleInit', () => {
    it('unwraps the configured index key via KMS without an encryption context', async () => {
      await buildTarget();

      const calls = kmsMock.commandCalls(DecryptCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toStrictEqual({
        CiphertextBlob: new Uint8Array(WRAPPED_INDEX_KEY),
        KeyId: keyId,
      });
    });

    it('unwraps the index key even when encryption is disabled (rollback safety)', async () => {
      await buildTarget({ enabled: false });

      expect(kmsMock.commandCalls(DecryptCommand)).toHaveLength(1);
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

    it('does not touch config or KMS when constructed without init (disabled default)', async () => {
      configurationService.get.mockReturnValue(undefined);
      configurationService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'spaces.fieldEncryption.enabled') return false;
        if (key === 'spaces.fieldEncryption.allowLegacyPlaintext') return true;
        throw new Error(`Unexpected config key: ${key}`);
      });

      const target = new KmsService(configurationService);
      await target.onModuleInit();

      expect(kmsMock.commandCalls(DecryptCommand)).toHaveLength(0);
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
      const ciphertextBlob = new Uint8Array([1, 2, 3, 4]);
      kmsMock.on(EncryptCommand).resolves({ CiphertextBlob: ciphertextBlob });

      const stored = await target.encrypt(42, 'alice@example.com');

      expect(stored).toBe(
        `kms:v1:${Buffer.from(ciphertextBlob).toString('base64url')}`,
      );
      const calls = kmsMock.commandCalls(EncryptCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toStrictEqual({
        KeyId: keyId,
        Plaintext: Buffer.from('alice@example.com', 'utf8'),
        EncryptionContext: { userId: '42', field: 'users.email' },
      });
    });

    it('returns the plaintext unchanged when encryption is disabled', async () => {
      const target = await buildTarget({ enabled: false });

      await expect(target.encrypt(42, 'alice@example.com')).resolves.toBe(
        'alice@example.com',
      );
      expect(kmsMock.commandCalls(EncryptCommand)).toHaveLength(0);
    });

    it('throws when KMS returns no ciphertext', async () => {
      const target = await buildTarget();
      kmsMock.on(EncryptCommand).resolves({});

      await expect(target.encrypt(42, 'a@b.com')).rejects.toThrow(
        'KMS did not return ciphertext',
      );
    });
  });

  describe('decrypt', () => {
    it('decrypts kms: values via KMS with the same encryption context', async () => {
      const target = await buildTarget();
      const blob = Buffer.from([9, 9, 9]);
      kmsMock.on(DecryptCommand).resolves({
        Plaintext: new Uint8Array(Buffer.from('alice@example.com', 'utf8')),
      });

      const plaintext = await target.decrypt(
        42,
        `kms:v1:${blob.toString('base64url')}`,
      );

      expect(plaintext).toBe('alice@example.com');
      const calls = kmsMock.commandCalls(DecryptCommand);
      // First Decrypt call was the index-key unwrap during init.
      expect(calls).toHaveLength(2);
      expect(calls[1].args[0].input).toStrictEqual({
        CiphertextBlob: new Uint8Array(blob),
        KeyId: keyId,
        EncryptionContext: { userId: '42', field: 'users.email' },
      });
    });

    it('decrypts kms: values even when encryption is disabled (rollback reads)', async () => {
      const target = await buildTarget({ enabled: false });
      kmsMock.on(DecryptCommand).resolves({
        Plaintext: new Uint8Array(Buffer.from('a@b.com', 'utf8')),
      });

      await expect(
        target.decrypt(7, `kms:v1:${Buffer.from('x').toString('base64url')}`),
      ).resolves.toBe('a@b.com');
    });

    it('passes legacy plaintext through while allowLegacyPlaintext is set', async () => {
      const target = await buildTarget({ allowLegacyPlaintext: true });

      await expect(target.decrypt(42, 'plain@example.com')).resolves.toBe(
        'plain@example.com',
      );
    });

    it('throws on legacy plaintext when allowLegacyPlaintext is disabled', async () => {
      const target = await buildTarget({ allowLegacyPlaintext: false });

      await expect(target.decrypt(42, 'plain@example.com')).rejects.toThrow(
        'legacy plaintext',
      );
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

    it('throws when KMS returns no plaintext', async () => {
      const target = await buildTarget();
      kmsMock.on(DecryptCommand).resolves({});

      await expect(
        target.decrypt(42, `kms:v1:${Buffer.from('x').toString('base64url')}`),
      ).rejects.toThrow('KMS did not return plaintext');
    });
  });

  describe('isEncrypted', () => {
    it('detects the kms: prefix', async () => {
      const target = await buildTarget();

      expect(target.isEncrypted('kms:v1:abc')).toBe(true);
      expect(target.isEncrypted('alice@example.com')).toBe(false);
    });
  });

  describe('generateDataKey', () => {
    it('returns the plaintext and encrypted key material from KMS', async () => {
      const target = await buildTarget();
      const plaintext = new Uint8Array(INDEX_KEY);
      const encrypted = new Uint8Array([1, 2, 3, 4]);
      kmsMock.on(GenerateDataKeyCommand).resolves({
        Plaintext: plaintext,
        CiphertextBlob: encrypted,
        KeyId: keyId,
      });

      const result = await target.generateDataKey();

      expect(result.plaintext).toStrictEqual(Buffer.from(plaintext));
      expect(result.encrypted).toStrictEqual(Buffer.from(encrypted));
      const calls = kmsMock.commandCalls(GenerateDataKeyCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toStrictEqual({
        KeyId: keyId,
        KeySpec: 'AES_256',
      });
    });

    it('throws when KMS returns no key material', async () => {
      const target = await buildTarget();
      kmsMock.on(GenerateDataKeyCommand).resolves({ KeyId: keyId });

      await expect(target.generateDataKey()).rejects.toThrow(
        'KMS did not return data key material',
      );
    });
  });

  describe('credentials', () => {
    it('resolves credentials from the web identity token file without requiring static credentials', async () => {
      await buildTarget({
        webIdentityTokenFile: '/var/run/secrets/token',
      });

      expect(configurationService.getOrThrow).not.toHaveBeenCalledWith(
        'spaces.fieldEncryption.kms.accessKeyId',
      );
      expect(configurationService.getOrThrow).not.toHaveBeenCalledWith(
        'spaces.fieldEncryption.kms.secretAccessKey',
      );
    });
  });
});
