import { fakeJson } from '@/__tests__/faker';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { AwsEncryptionApiService } from '@/datasources/accounts/encryption/aws-encryption-api.service';
import { encryptedBlobBuilder } from '@/datasources/accounts/encryption/entities/__tests__/encrypted-blob.builder';
import {
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { faker } from '@faker-js/faker/.';
import { mockClient } from 'aws-sdk-client-mock';
import { randomBytes } from 'crypto';

const mockConfigurationService = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

describe('AwsEncryptionApiService', () => {
  let target: AwsEncryptionApiService;
  const kmsMock = mockClient(KMSClient);
  const awsKmsKeyId = faker.string.uuid();

  beforeEach(() => {
    jest.resetAllMocks();
    mockConfigurationService.get.mockImplementation((key) => {
      if (key === 'accounts.encryption.awsKms.keyId') return awsKmsKeyId;
      throw new Error(`Unexpected key: ${key}`);
    });
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'accounts.encryption.awsKms.algorithm') return 'aes-256-cbc';
      throw new Error(`Unexpected key: ${key}`);
    });
    target = new AwsEncryptionApiService(mockConfigurationService);
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const data = faker.string.alphanumeric();
      kmsMock.on(EncryptCommand).resolves({
        CiphertextBlob: Buffer.from(data),
      });
      kmsMock.on(DecryptCommand).resolves({
        Plaintext: Buffer.from(data),
      });
      const encrypted = await target.encrypt(data);
      const decrypted = await target.decrypt(encrypted);

      expect(decrypted).toBe(data);
      expect(
        kmsMock.commandCalls(EncryptCommand, {
          KeyId: awsKmsKeyId,
          Plaintext: Buffer.from(data),
        }),
      ).toHaveLength(1);
      expect(
        kmsMock.commandCalls(DecryptCommand, {
          CiphertextBlob: Buffer.from(encrypted, 'base64'),
        }),
      ).toHaveLength(1);
    });

    it('should fail to encrypt when the KMS client fails', async () => {
      const data = faker.string.alphanumeric();
      kmsMock.on(EncryptCommand).rejects(new Error('Test error'));
      await expect(target.encrypt(data)).rejects.toThrow('Test error');
    });

    it('should fail to decrypt when the KMS client fails', async () => {
      const data = faker.string.alphanumeric();
      kmsMock.on(DecryptCommand).rejects(new Error('Test error'));
      await expect(target.decrypt(data)).rejects.toThrow('Test error');
    });

    it('should fail to encrypt when the KMS client does not return a CiphertextBlob', async () => {
      const data = faker.string.alphanumeric();
      kmsMock.on(EncryptCommand).resolves({});
      await expect(target.encrypt(data)).rejects.toThrow(
        'Failed to encrypt data',
      );
    });

    it('should fail to decrypt when the KMS client does not return a Plaintext', async () => {
      const data = faker.string.alphanumeric();
      kmsMock.on(DecryptCommand).resolves({});
      await expect(target.decrypt(data)).rejects.toThrow(
        'Failed to decrypt data',
      );
    });
  });

  describe('encryptBlob/decryptBlob', () => {
    it('should encrypt and decrypt arrays of objects correctly', async () => {
      const data = [JSON.parse(fakeJson()), JSON.parse(fakeJson())];
      const key = randomBytes(32);
      const encryptedBlob = encryptedBlobBuilder().build();
      kmsMock.on(GenerateDataKeyCommand).resolves({
        Plaintext: Buffer.from(key),
        CiphertextBlob: Buffer.from(encryptedBlob.encryptedDataKey),
      });
      kmsMock.on(EncryptCommand).resolves({
        CiphertextBlob: encryptedBlob.encryptedDataKey,
      });
      kmsMock.on(DecryptCommand).resolves({
        Plaintext: Buffer.from(key),
      });
      const encrypted = await target.encryptBlob(data);
      const decrypted = await target.decryptBlob(encrypted);

      expect(decrypted).toStrictEqual(data);
    });

    it('should fail to encrypt when the KMS client fails to generate the key', async () => {
      const data = [JSON.parse(fakeJson()), JSON.parse(fakeJson())];
      kmsMock.on(GenerateDataKeyCommand).rejects(new Error('Test error'));
      await expect(target.encryptBlob(data)).rejects.toThrow('Test error');
    });

    it('should fail to encrypt when the KMS client does not return a CiphertextBlob key', async () => {
      const data = [JSON.parse(fakeJson()), JSON.parse(fakeJson())];
      kmsMock
        .on(GenerateDataKeyCommand)
        .resolves({ Plaintext: Buffer.from([]) });
      await expect(target.encryptBlob(data)).rejects.toThrow(
        'Failed to generate data key',
      );
    });

    it('should fail to encrypt when the KMS client does not return a Plaintext key', async () => {
      const data = [JSON.parse(fakeJson()), JSON.parse(fakeJson())];
      kmsMock
        .on(GenerateDataKeyCommand)
        .resolves({ CiphertextBlob: Buffer.from([]) });
      await expect(target.encryptBlob(data)).rejects.toThrow(
        'Failed to generate data key',
      );
    });

    it('should fail to encrypt non-object data', async () => {
      await expect(
        target.encryptBlob(faker.string.alphanumeric()),
      ).rejects.toThrow('Data must be an object or array');
    });

    it('should fail to encrypt null data', async () => {
      await expect(target.encryptBlob(null)).rejects.toThrow(
        'Data must be an object or array',
      );
    });

    it('should fail to encrypt undefined data', async () => {
      await expect(target.encryptBlob(undefined)).rejects.toThrow(
        'Data must be an object or array',
      );
    });

    it('should fail to decrypt when the KMS client fails while decrypting the key', async () => {
      const encryptedBlob = encryptedBlobBuilder().build();
      kmsMock.on(DecryptCommand).rejects(new Error('Test error'));
      await expect(target.decryptBlob(encryptedBlob)).rejects.toThrow(
        'Test error',
      );
    });
  });
});
