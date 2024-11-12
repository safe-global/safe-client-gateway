import type { IConfigurationService } from '@/config/configuration.service.interface';
import { LocalEncryptionApiService } from '@/datasources/accounts/encryption/local-encryption-api.service';

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
      if (key === 'accounts.encryption.local.key') return 'a'.repeat(64);
      if (key === 'accounts.encryption.local.iv') return 'b'.repeat(32);
      throw new Error(`Unexpected key: ${key}`);
    });
    target = new LocalEncryptionApiService(mockConfigurationService);
  });

  it('should fail to encrypt in production', async () => {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'application.isProduction') return true;
      if (key === 'accounts.encryption.local.algorithm') return 'aes-256-cbc';
      if (key === 'accounts.encryption.local.key') return 'a'.repeat(64);
      if (key === 'accounts.encryption.local.iv') return 'b'.repeat(32);
      throw new Error(`Unexpected key: ${key}`);
    });
    target = new LocalEncryptionApiService(mockConfigurationService);

    await expect(target.encrypt('data')).rejects.toThrow(
      'Local encryption is not suitable for production usage',
    );
  });

  it('should fail to decrypt in production', async () => {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'application.isProduction') return true;
      if (key === 'accounts.encryption.local.algorithm') return 'aes-256-cbc';
      if (key === 'accounts.encryption.local.key') return 'a'.repeat(64);
      if (key === 'accounts.encryption.local.iv') return 'b'.repeat(32);
      throw new Error(`Unexpected key: ${key}`);
    });
    target = new LocalEncryptionApiService(mockConfigurationService);

    await expect(target.decrypt('data')).rejects.toThrow(
      'Local encryption is not suitable for production usage',
    );
  });

  it('should encrypt and decrypt data correctly', async () => {
    const data = 'test data';
    const encrypted = await target.encrypt(data);
    const decrypted = await target.decrypt(encrypted);

    expect(decrypted).toBe(data);
  });
});
