import type { IConfigurationService } from '@/config/configuration.service.interface';
import { AwsEncryptionApiService } from '@/datasources/accounts/encryption/aws-encryption-api.service';
import { EncryptionApiManager } from '@/datasources/accounts/encryption/encryption-api.manager';
import { LocalEncryptionApiService } from '@/datasources/accounts/encryption/local-encryption-api.service';

const mockConfigurationService = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

describe('EncryptionApiManager', () => {
  let target: EncryptionApiManager;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should get a LocalEncryptionApiService', async () => {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'accounts.encryption.type') return 'local';
      if (key === 'application.isProduction') return false;
      if (key === 'accounts.encryption.local.algorithm') return 'aes-256-cbc';
      if (key === 'accounts.encryption.local.key') return 'a'.repeat(64);
      if (key === 'accounts.encryption.local.iv') return 'b'.repeat(32);
      throw new Error(`Unexpected key: ${key}`);
    });
    target = new EncryptionApiManager(mockConfigurationService);

    const api = await target.getApi();

    expect(api).toBeInstanceOf(LocalEncryptionApiService);
  });

  it('should return the same instance of LocalEncryptionApiService on a second call', async () => {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'accounts.encryption.type') return 'local';
      if (key === 'application.isProduction') return false;
      if (key === 'accounts.encryption.local.algorithm') return 'aes-256-cbc';
      if (key === 'accounts.encryption.local.key') return 'a'.repeat(64);
      if (key === 'accounts.encryption.local.iv') return 'b'.repeat(32);
      throw new Error(`Unexpected key: ${key}`);
    });
    target = new EncryptionApiManager(mockConfigurationService);

    const api = await target.getApi();
    const cachedApi = await target.getApi();

    expect(api).toBe(cachedApi);
    expect(api).toBeInstanceOf(LocalEncryptionApiService);
  });

  it('should get a AwsEncryptionApiService', async () => {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'accounts.encryption.type') return 'aws';
      throw new Error(`Unexpected key: ${key}`);
    });
    target = new EncryptionApiManager(mockConfigurationService);

    const api = await target.getApi();

    expect(api).toBeInstanceOf(AwsEncryptionApiService);
  });

  it('should return the same instance of AwsEncryptionApiService on a second call', async () => {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'accounts.encryption.type') return 'aws';
      if (key === 'accounts.encryption.awsKms.keyId') return 'aes-256-gcm';
      if (key === 'accounts.encryption.awsKms.algorithm') return 'aes-256-gcm';
      throw new Error(`Unexpected key: ${key}`);
    });
    target = new EncryptionApiManager(mockConfigurationService);

    const api = await target.getApi();
    const cachedApi = await target.getApi();

    expect(api).toBe(cachedApi);
    expect(api).toBeInstanceOf(AwsEncryptionApiService);
  });
});
