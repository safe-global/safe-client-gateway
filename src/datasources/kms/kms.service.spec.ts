// SPDX-License-Identifier: FSL-1.1-MIT

import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { faker } from '@faker-js/faker';
import { mockClient } from 'aws-sdk-client-mock';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { KmsService } from '@/datasources/kms/kms.service';

const configurationService = {
  getOrThrow: vi.fn(),
  get: vi.fn(),
} as unknown as MockedObject<IConfigurationService>;

const keyId = faker.string.uuid();
const region = faker.helpers.arrayElement([
  'eu-central-1',
  'eu-west-1',
  'us-east-1',
]);
const accessKeyId = faker.string.alphanumeric(20);
const secretAccessKey = faker.string.alphanumeric(40);

// KmsService is domain-agnostic: it must pass any caller-supplied context
// through verbatim, so the spec uses an arbitrary one.
const encryptionContext: Record<string, string> = {
  [`a${faker.string.alpha(8)}`]: faker.string.alphanumeric(16),
  [`b${faker.string.alpha(8)}`]: faker.string.alphanumeric(16),
};

function randomBytes(count: number): Uint8Array {
  return Uint8Array.from(
    faker.helpers.multiple(() => faker.number.int({ min: 0, max: 255 }), {
      count,
    }),
  );
}

describe('KmsService', () => {
  const kmsMock = mockClient(KMSClient);

  beforeEach(() => {
    vi.resetAllMocks();
    kmsMock.reset();
  });

  function mockConfiguration(args?: { webIdentityTokenFile?: string }): void {
    configurationService.get.mockImplementation((key: string) => {
      if (key === 'spaces.fieldEncryption.kms.keyId') {
        return keyId;
      }
      if (key === 'spaces.fieldEncryption.kms.webIdentityTokenFile') {
        return args?.webIdentityTokenFile;
      }
      return undefined;
    });
    configurationService.getOrThrow.mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        'spaces.fieldEncryption.kms.region': region,
        'spaces.fieldEncryption.kms.accessKeyId': accessKeyId,
        'spaces.fieldEncryption.kms.secretAccessKey': secretAccessKey,
      };
      if (key in values) return values[key];
      throw new Error(`Unexpected config key: ${key}`);
    });
  }

  function buildTarget(args?: { webIdentityTokenFile?: string }): KmsService {
    mockConfiguration(args);
    return new KmsService(configurationService);
  }

  describe('construction', () => {
    it('constructs without KMS configuration, so the app boots with field encryption disabled', () => {
      configurationService.getOrThrow.mockImplementation((key: string) => {
        throw new Error(`Missing required configuration: ${key}`);
      });

      expect(() => new KmsService(configurationService)).not.toThrow();
    });

    it('resolves the client eagerly when a key is configured, so a partial configuration fails at construction', () => {
      configurationService.get.mockImplementation((key: string) =>
        key === 'spaces.fieldEncryption.kms.keyId' ? keyId : undefined,
      );
      configurationService.getOrThrow.mockImplementation((key: string) => {
        throw new Error(`Missing required configuration: ${key}`);
      });

      expect(() => new KmsService(configurationService)).toThrow(
        'Missing required configuration: spaces.fieldEncryption.kms.region',
      );
    });

    it('fails loudly if a KMS call is made while KMS is not configured', async () => {
      const target = new KmsService(configurationService);

      await expect(
        target.encrypt({
          plaintext: Buffer.from(faker.string.alphanumeric(12)),
        }),
      ).rejects.toThrow(
        'AWS KMS is not configured: spaces.fieldEncryption.kms.keyId is required',
      );
    });
  });

  describe('encrypt', () => {
    it('encrypts under the configured key with the provided encryption context and returns the raw blob', async () => {
      const target = buildTarget();
      const email = faker.internet.email();
      const ciphertextBlob = randomBytes(16);
      kmsMock.on(EncryptCommand).resolves({ CiphertextBlob: ciphertextBlob });

      const ciphertext = await target.encrypt({
        plaintext: Buffer.from(email, 'utf8'),
        encryptionContext,
      });

      expect(ciphertext).toStrictEqual(Buffer.from(ciphertextBlob));
      const calls = kmsMock.commandCalls(EncryptCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toStrictEqual({
        KeyId: keyId,
        Plaintext: new Uint8Array(Buffer.from(email, 'utf8')),
        EncryptionContext: encryptionContext,
      });
    });

    it('omits the encryption context when none is provided', async () => {
      const target = buildTarget();
      const plaintext = faker.string.alphanumeric(12);
      kmsMock.on(EncryptCommand).resolves({
        CiphertextBlob: randomBytes(8),
      });

      await target.encrypt({ plaintext: Buffer.from(plaintext) });

      expect(
        kmsMock.commandCalls(EncryptCommand)[0].args[0].input,
      ).toStrictEqual({
        KeyId: keyId,
        Plaintext: new Uint8Array(Buffer.from(plaintext)),
      });
    });

    it('throws when KMS returns no ciphertext', async () => {
      const target = buildTarget();
      kmsMock.on(EncryptCommand).resolves({});

      await expect(
        target.encrypt({
          plaintext: Buffer.from(faker.string.alphanumeric(12)),
        }),
      ).rejects.toThrow('Could not encrypt data');
    });
  });

  describe('decrypt', () => {
    it('decrypts under the configured key with the provided encryption context', async () => {
      const target = buildTarget();
      const email = faker.internet.email();
      const blob = Buffer.from(randomBytes(16));
      kmsMock.on(DecryptCommand).resolves({
        Plaintext: new Uint8Array(Buffer.from(email, 'utf8')),
      });

      const plaintext = await target.decrypt({
        ciphertext: blob,
        encryptionContext,
      });

      expect(plaintext.toString('utf8')).toBe(email);
      const calls = kmsMock.commandCalls(DecryptCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toStrictEqual({
        CiphertextBlob: new Uint8Array(blob),
        KeyId: keyId,
        EncryptionContext: encryptionContext,
      });
    });

    it('omits the encryption context when none is provided', async () => {
      const target = buildTarget();
      const wrapped = Buffer.from(randomBytes(24));
      kmsMock.on(DecryptCommand).resolves({
        Plaintext: randomBytes(32),
      });

      await target.decrypt({ ciphertext: wrapped });

      expect(
        kmsMock.commandCalls(DecryptCommand)[0].args[0].input,
      ).toStrictEqual({
        CiphertextBlob: new Uint8Array(wrapped),
        KeyId: keyId,
      });
    });

    it('throws when KMS returns no plaintext', async () => {
      const target = buildTarget();
      kmsMock.on(DecryptCommand).resolves({});

      await expect(
        target.decrypt({ ciphertext: Buffer.from(randomBytes(24)) }),
      ).rejects.toThrow('Could not decrypt data');
    });
  });

  describe('credentials', () => {
    it('resolves credentials from the web identity token file without requiring static credentials', () => {
      buildTarget({
        webIdentityTokenFile: `/var/run/secrets/${faker.string.alphanumeric(8)}/token`,
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
