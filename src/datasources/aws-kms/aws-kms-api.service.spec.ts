// SPDX-License-Identifier: FSL-1.1-MIT

import {
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { faker } from '@faker-js/faker';
import { mockClient } from 'aws-sdk-client-mock';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { AwsKmsApiService } from '@/datasources/aws-kms/aws-kms-api.service';

const configurationService = {
  getOrThrow: vi.fn(),
  get: vi.fn(),
} as unknown as IConfigurationService;
const mockConfigurationService = vi.mocked(configurationService);

describe('AwsKmsApiService', () => {
  const kmsMock = mockClient(KMSClient);
  const keyId = faker.string.uuid();
  const region = 'eu-central-1';
  const accessKeyId = faker.string.alphanumeric();
  const secretAccessKey = faker.string.alphanumeric();

  let target: AwsKmsApiService;

  beforeEach(() => {
    vi.resetAllMocks();
    kmsMock.reset();

    mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        'spaces.fieldEncryption.kms.keyId': keyId,
        'spaces.fieldEncryption.kms.region': region,
        'spaces.fieldEncryption.kms.accessKeyId': accessKeyId,
        'spaces.fieldEncryption.kms.secretAccessKey': secretAccessKey,
      };
      if (key in values) return values[key];
      throw new Error(`Unexpected config key: ${key}`);
    });
    mockConfigurationService.get.mockReturnValue(undefined);

    target = new AwsKmsApiService(configurationService);
  });

  describe('construction', () => {
    it('can be constructed without any KMS configuration', () => {
      mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
        throw new Error(`No configuration for key: ${key}`);
      });
      mockConfigurationService.get.mockReturnValue(undefined);

      expect(() => new AwsKmsApiService(configurationService)).not.toThrow();
      expect(mockConfigurationService.getOrThrow).not.toHaveBeenCalled();
    });

    it('resolves credentials from the web identity token file without requiring static credentials', async () => {
      mockConfigurationService.get.mockImplementation((key: string) =>
        key === 'spaces.fieldEncryption.kms.webIdentityTokenFile'
          ? '/var/run/secrets/token'
          : undefined,
      );
      mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
        const values: Record<string, unknown> = {
          'spaces.fieldEncryption.kms.keyId': keyId,
          'spaces.fieldEncryption.kms.region': region,
        };
        if (key in values) return values[key];
        throw new Error(`Unexpected config key: ${key}`);
      });
      kmsMock.on(GenerateDataKeyCommand).resolves({
        Plaintext: new Uint8Array(randomBytes32()),
        CiphertextBlob: new Uint8Array([1, 2, 3, 4]),
        KeyId: keyId,
      });

      await expect(target.generateDataKey()).resolves.toBeDefined();
      expect(mockConfigurationService.getOrThrow).not.toHaveBeenCalledWith(
        'spaces.fieldEncryption.kms.accessKeyId',
      );
      expect(mockConfigurationService.getOrThrow).not.toHaveBeenCalledWith(
        'spaces.fieldEncryption.kms.secretAccessKey',
      );
    });
  });

  describe('generateDataKey', () => {
    it('returns the plaintext and encrypted key material from KMS', async () => {
      const plaintext = new Uint8Array(randomBytes32());
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
      kmsMock.on(GenerateDataKeyCommand).resolves({ KeyId: keyId });

      await expect(target.generateDataKey()).rejects.toThrow(
        'KMS did not return data key material',
      );
    });
  });

  describe('encrypt', () => {
    it('wraps key material and passes the encryption context to KMS', async () => {
      const plaintext = Buffer.from(randomBytes32());
      const encrypted = new Uint8Array([1, 2, 3]);
      const encryptionContext = { spaceId: '42' };
      kmsMock.on(EncryptCommand).resolves({ CiphertextBlob: encrypted });

      const result = await target.encrypt(plaintext, encryptionContext);

      expect(result).toStrictEqual(Buffer.from(encrypted));
      const calls = kmsMock.commandCalls(EncryptCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toStrictEqual({
        KeyId: keyId,
        Plaintext: plaintext,
        EncryptionContext: encryptionContext,
      });
    });

    it('throws when KMS returns no ciphertext', async () => {
      kmsMock.on(EncryptCommand).resolves({});

      await expect(
        target.encrypt(Buffer.from([1]), { spaceId: '1' }),
      ).rejects.toThrow('KMS did not return ciphertext');
    });
  });

  describe('decrypt', () => {
    it('returns the plaintext key material from KMS', async () => {
      const encrypted = Buffer.from([5, 6, 7, 8]);
      const plaintext = new Uint8Array(randomBytes32());
      kmsMock.on(DecryptCommand).resolves({ Plaintext: plaintext });

      const result = await target.decrypt(encrypted);

      expect(result).toStrictEqual(Buffer.from(plaintext));
      const calls = kmsMock.commandCalls(DecryptCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toStrictEqual({
        CiphertextBlob: encrypted,
        KeyId: keyId,
      });
    });

    it('forwards the encryption context when provided', async () => {
      const encrypted = Buffer.from([5, 6, 7, 8]);
      const plaintext = new Uint8Array(randomBytes32());
      const encryptionContext = { userId: '7' };
      kmsMock.on(DecryptCommand).resolves({ Plaintext: plaintext });

      await target.decrypt(encrypted, encryptionContext);

      const calls = kmsMock.commandCalls(DecryptCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toStrictEqual({
        CiphertextBlob: encrypted,
        KeyId: keyId,
        EncryptionContext: encryptionContext,
      });
    });

    it('throws when KMS returns no plaintext', async () => {
      kmsMock.on(DecryptCommand).resolves({});

      await expect(target.decrypt(Buffer.from([9]))).rejects.toThrow(
        'KMS did not return decrypted key material',
      );
    });
  });
});

function randomBytes32(): Array<number> {
  return Array.from({ length: 32 }, () =>
    faker.number.int({ min: 0, max: 255 }),
  );
}
