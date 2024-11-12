import { IConfigurationService } from '@/config/configuration.service.interface';
import { AccountsEncryptionType } from '@/config/entities/schemas/configuration.schema';
import type { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  CreateKeyCommand,
  EncryptCommand,
  KMSClient,
  ListKeysCommand,
} from '@aws-sdk/client-kms';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class AwsEncryptionApiService implements IEncryptionApi, OnModuleInit {
  private readonly kmsClient: KMSClient;
  private awsKmsKeyId: string | undefined; // TODO: readonly after local encryption implementation
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

  async onModuleInit(): Promise<void> {
    if (this.accountsEncryptionType === 'local') {
      // TODO: move to a separate IEncryptionApi implementation and refactor to use local encryption
      // instead of AWS KMS LocalStack implementation.
      const keyId = await this.createKey();
      await this.listKeys();
      this.awsKmsKeyId = keyId;
    }
    const encryptedData = await this.encrypt('testData');
    this.loggingService.info(`Encrypted Data: ${encryptedData}`);

    // const decryptedData = await this.kmsClient.send(
    //   new DecryptCommand({ CiphertextBlob: encryptedData }),
    // );
    // const decryptedString = decryptedData.Plaintext
    //   ? Buffer.from(decryptedData.Plaintext).toString('utf-8')
    //   : '';
    // this.loggingService.info(`Decrypted Data: ${decryptedString}`);
  }

  async encrypt(data: string): Promise<string> {
    const encryptedData = await this.kmsClient.send(
      new EncryptCommand({
        KeyId: this.awsKmsKeyId,
        Plaintext: Buffer.from(data),
      }),
    );
    this.loggingService.info(`Encrypted Data: ${encryptedData.CiphertextBlob}`);

    return encryptedData.CiphertextBlob
      ? Buffer.from(encryptedData.CiphertextBlob).toString('base64')
      : '';
  }

  decrypt(data: string): Promise<string> {
    this.loggingService.info(`Encrypting data: ${data}`);
    throw new Error('Method not implemented.');
  }

  // TODO: remove this function after the key is created
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

  // TODO: remove this function after the key is created
  async listKeys(): Promise<void> {
    const command = new ListKeysCommand({});
    const response = await this.kmsClient.send(command);
    console.log('Available Keys:', response.Keys);
  }
}
