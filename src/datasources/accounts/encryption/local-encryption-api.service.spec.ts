import { fakeJson } from '@/__tests__/faker';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { encryptedBlobBuilder } from '@/datasources/accounts/encryption/entities/__tests__/encrypted-blob.builder';
import { LocalEncryptionApiService } from '@/datasources/accounts/encryption/local-encryption-api.service';
import { faker } from '@faker-js/faker/.';
import { randomBytes } from 'crypto';

const mockConfigurationService = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

describe('LocalEncryptionApiService', () => {
  let target: LocalEncryptionApiService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'application.isProduction') return false;
      if (key === 'accounts.encryption.local.algorithm') return 'aes-256-cbc';
      if (key === 'accounts.encryption.local.key')
        return new Uint8Array(randomBytes(32).buffer);
      if (key === 'accounts.encryption.local.iv') return randomBytes(16);
      throw new Error(`Unexpected key: ${key}`);
    });
    target = new LocalEncryptionApiService(mockConfigurationService);
  });

  describe('encrypt/decrypt', () => {
    it('should fail to encrypt in production', async () => {
      mockConfigurationService.getOrThrow.mockImplementation((key) => {
        if (key === 'application.isProduction') return true;
        if (key === 'accounts.encryption.local.algorithm') return 'aes-256-cbc';
        if (key === 'accounts.encryption.local.key')
          return new Uint8Array(randomBytes(32).buffer);
        if (key === 'accounts.encryption.local.iv') return randomBytes(16);
        throw new Error(`Unexpected key: ${key}`);
      });
      target = new LocalEncryptionApiService(mockConfigurationService);

      await expect(target.encrypt(faker.string.alphanumeric())).rejects.toThrow(
        'Local encryption is not suitable for production usage',
      );
    });

    it('should fail to decrypt in production', async () => {
      mockConfigurationService.getOrThrow.mockImplementation((key) => {
        if (key === 'application.isProduction') return true;
        if (key === 'accounts.encryption.local.algorithm') return 'aes-256-cbc';
        if (key === 'accounts.encryption.local.key')
          return new Uint8Array(randomBytes(32).buffer);
        if (key === 'accounts.encryption.local.iv') return randomBytes(16);
        throw new Error(`Unexpected key: ${key}`);
      });
      target = new LocalEncryptionApiService(mockConfigurationService);

      await expect(target.decrypt(faker.string.alphanumeric())).rejects.toThrow(
        'Local encryption is not suitable for production usage',
      );
    });

    it('should encrypt and decrypt data correctly', async () => {
      const data = faker.string.alphanumeric({ length: 100 });
      const encrypted = await target.encrypt(data);
      const decrypted = await target.decrypt(encrypted);

      expect(decrypted).toBe(data);
    });

    it('should encrypt and decrypt objects correctly', async () => {
      const data = JSON.parse(fakeJson());
      const encrypted = await target.encryptBlob(data);
      const decrypted = await target.decryptBlob(encrypted);

      expect(decrypted).toStrictEqual(data);
    });
  });

  describe('encryptBlob/decryptBlob', () => {
    it('should fail to encryptBlob in production', async () => {
      mockConfigurationService.getOrThrow.mockImplementation((key) => {
        if (key === 'application.isProduction') return true;
        if (key === 'accounts.encryption.local.algorithm') return 'aes-256-cbc';
        if (key === 'accounts.encryption.local.key')
          return new Uint8Array(randomBytes(32).buffer);
        if (key === 'accounts.encryption.local.iv') return randomBytes(16);
        throw new Error(`Unexpected key: ${key}`);
      });
      target = new LocalEncryptionApiService(mockConfigurationService);

      await expect(
        target.encryptBlob(faker.string.alphanumeric()),
      ).rejects.toThrow(
        'Local encryption is not suitable for production usage',
      );
    });

    it('should fail to decryptBlob in production', async () => {
      mockConfigurationService.getOrThrow.mockImplementation((key) => {
        if (key === 'application.isProduction') return true;
        if (key === 'accounts.encryption.local.algorithm') return 'aes-256-cbc';
        if (key === 'accounts.encryption.local.key')
          return new Uint8Array(randomBytes(32).buffer);
        if (key === 'accounts.encryption.local.iv') return randomBytes(16);
        throw new Error(`Unexpected key: ${key}`);
      });
      target = new LocalEncryptionApiService(mockConfigurationService);

      await expect(
        target.decryptBlob(encryptedBlobBuilder().build()),
      ).rejects.toThrow(
        'Local encryption is not suitable for production usage',
      );
    });

    it('should encrypt and decrypt arrays of objects correctly', async () => {
      const data = faker.helpers.multiple(() => JSON.parse(fakeJson()), {
        count: 10,
      });
      const encrypted = await target.encryptBlob(data);
      const decrypted = await target.decryptBlob(encrypted);

      expect(decrypted).toStrictEqual(data);
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
  });
});
