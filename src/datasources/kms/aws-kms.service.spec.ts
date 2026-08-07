// SPDX-License-Identifier: FSL-1.1-MIT

import {
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { faker } from '@faker-js/faker';
import { mockClient } from 'aws-sdk-client-mock';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { AwsKmsService } from '@/datasources/kms/aws-kms.service';

const keyId = faker.string.uuid();
const accessKeyId = faker.string.alphanumeric(20);
const secretAccessKey = faker.string.alphanumeric(40);

// AwsKmsService is domain-agnostic: it must pass any caller-supplied context
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

describe('AwsKmsService', () => {
  const kmsMock = mockClient(KMSClient);

  beforeEach(() => {
    vi.resetAllMocks();
    kmsMock.reset();
  });

  function buildTarget(args?: {
    webIdentityTokenFile?: string;
  }): AwsKmsService {
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('encryption.kms.keyId', keyId);
    if (args?.webIdentityTokenFile) {
      fakeConfigurationService.set(
        'encryption.kms.webIdentityTokenFile',
        args.webIdentityTokenFile,
      );
    } else {
      fakeConfigurationService.set('encryption.kms.accessKeyId', accessKeyId);
      fakeConfigurationService.set(
        'encryption.kms.secretAccessKey',
        secretAccessKey,
      );
    }
    return new AwsKmsService(fakeConfigurationService);
  }

  describe('construction', () => {
    it('constructs without KMS configuration, so the app boots with field encryption disabled', () => {
      expect(
        () => new AwsKmsService(new FakeConfigurationService()),
      ).not.toThrow();
    });

    it('resolves the client eagerly when a key is configured, so a partial configuration fails at construction', () => {
      const fakeConfigurationService = new FakeConfigurationService();
      fakeConfigurationService.set('encryption.kms.keyId', keyId);

      expect(() => new AwsKmsService(fakeConfigurationService)).toThrow(
        'No value set for key encryption.kms.accessKeyId',
      );
    });

    it('fails loudly if a KMS call is made while KMS is not configured', async () => {
      const target = new AwsKmsService(new FakeConfigurationService());

      await expect(
        target.encrypt({
          plaintext: Buffer.from(faker.string.alphanumeric(12)),
        }),
      ).rejects.toThrow(
        'AWS KMS is not configured: encryption.kms.keyId is required',
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

  describe('generateDataKey', () => {
    it('generates an AES-256 data key under the configured key, bound to the provided encryption context', async () => {
      const target = buildTarget();
      const plaintextKey = randomBytes(32);
      const wrappedKey = randomBytes(64);
      kmsMock.on(GenerateDataKeyCommand).resolves({
        Plaintext: plaintextKey,
        CiphertextBlob: wrappedKey,
      });

      const dataKey = await target.generateDataKey({ encryptionContext });

      expect(dataKey.plaintextKey).toStrictEqual(Buffer.from(plaintextKey));
      expect(dataKey.wrappedKey).toStrictEqual(Buffer.from(wrappedKey));
      const calls = kmsMock.commandCalls(GenerateDataKeyCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toStrictEqual({
        KeyId: keyId,
        KeySpec: 'AES_256',
        EncryptionContext: encryptionContext,
      });
    });

    it('omits the encryption context when none is provided', async () => {
      const target = buildTarget();
      kmsMock.on(GenerateDataKeyCommand).resolves({
        Plaintext: randomBytes(32),
        CiphertextBlob: randomBytes(64),
      });

      await target.generateDataKey({});

      expect(
        kmsMock.commandCalls(GenerateDataKeyCommand)[0].args[0].input,
      ).toStrictEqual({ KeyId: keyId, KeySpec: 'AES_256' });
    });

    it('throws when KMS returns an incomplete data key', async () => {
      const target = buildTarget();
      kmsMock.on(GenerateDataKeyCommand).resolves({
        Plaintext: randomBytes(32),
      });

      await expect(target.generateDataKey({})).rejects.toThrow(
        'Could not generate a data key',
      );
    });
  });

  describe('credentials', () => {
    it('resolves credentials from the web identity token file without requiring static credentials', () => {
      expect(() =>
        buildTarget({
          webIdentityTokenFile: `/var/run/secrets/${faker.string.alphanumeric(8)}/token`,
        }),
      ).not.toThrow();
    });
  });
});
