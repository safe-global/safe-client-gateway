import { IConfigurationService } from '@/config/configuration.service.interface';
import { AccountsEncryptionType } from '@/config/entities/schemas/configuration.schema';
import type { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  CreateKeyCommand,
  DecryptCommand,
  EncryptCommand,
  KMSClient,
  ListKeysCommand,
} from '@aws-sdk/client-kms';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AwsEncryptionApiService implements IEncryptionApi {
  private readonly kmsClient: KMSClient;
  private awsKmsKeyId: string | undefined; // TODO: remove this when not using LocalStack
  private readonly accountsEncryptionType: AccountsEncryptionType;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.accountsEncryptionType =
      this.configurationService.getOrThrow<AccountsEncryptionType>(
        'accounts.encryption.type',
      );
    this.awsKmsKeyId = this.configurationService.get<string>(
      'accounts.encryption.awsKms.keyId',
    );
    this.kmsClient = new KMSClient({
      // TODO: localstack
      endpoint: 'http://localhost:4566',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });
  }
  async initKey(): Promise<void> {
    // TODO: remove this when not using LocalStack
    if (this.awsKmsKeyId) {
      return;
    }
    const keyId = await this.createKey();
    await this.listKeys();
    this.awsKmsKeyId = keyId;
  }

  async encrypt(data: string): Promise<string> {
    await this.initKey();
    const encryptedData = await this.kmsClient.send(
      new EncryptCommand({
        KeyId: this.awsKmsKeyId,
        Plaintext: Buffer.from(data),
      }),
    );
    if (!encryptedData.CiphertextBlob) {
      throw new Error('Failed to encrypt data');
    }
    return Buffer.from(encryptedData.CiphertextBlob).toString('base64');
  }

  async decrypt(data: string): Promise<string> {
    await this.initKey();
    const decryptedData = await this.kmsClient.send(
      new DecryptCommand({ CiphertextBlob: Buffer.from(data, 'base64') }),
    );
    if (!decryptedData.Plaintext) {
      throw new Error('Failed to decrypt data');
    }
    return Buffer.from(decryptedData.Plaintext).toString('utf-8');
  }

  // TODO: remove this when not using LocalStack
  async createKey(): Promise<string> {
    const command = new CreateKeyCommand({
      Description: 'Test key for LocalStack',
      KeyUsage: 'ENCRYPT_DECRYPT',
      XksKeyId: this.awsKmsKeyId,
    });
    const response = await this.kmsClient.send(command);
    this.loggingService.info(`Created Key: ${response.KeyMetadata?.KeyId}`);
    return response.KeyMetadata?.KeyId || '';
  }

  // TODO: remove this when not using LocalStack
  async listKeys(): Promise<void> {
    const command = new ListKeysCommand({});
    const response = await this.kmsClient.send(command);
    console.log('Available Keys:', response.Keys);
  }
}
