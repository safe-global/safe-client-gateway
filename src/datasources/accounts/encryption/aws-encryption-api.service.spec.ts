import type { IConfigurationService } from '@/config/configuration.service.interface';
import { AwsEncryptionApiService } from '@/datasources/accounts/encryption/aws-encryption-api.service';
import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { faker } from '@faker-js/faker/.';
import { mockClient } from 'aws-sdk-client-mock';

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
      if (key === 'accounts.encryption.awsKms.algorithm') return 'aes-256-gcm';
      throw new Error(`Unexpected key: ${key}`);
    });
    target = new AwsEncryptionApiService(mockConfigurationService);
  });

  it('should encrypt and decrypt data correctly', async () => {
    const data = 'test data';
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

  it.todo('should fail to encrypt when the KMS client fails');
  it.todo('should fail to decrypt when the KMS client fails');
  it.todo(
    'should fail to encrypt when the KMS client does not return a CiphertextBlob',
  );
  it.todo(
    'should fail to decrypt when the KMS client does not return a Plaintext',
  );
  it.todo('should encrypt and decrypt arrays of objects correctly');
  it.todo('should fail to encrypt non-object data');
  it.todo('should fail to encrypt null data');
  it.todo('should fail to encrypt undefined data');
});
