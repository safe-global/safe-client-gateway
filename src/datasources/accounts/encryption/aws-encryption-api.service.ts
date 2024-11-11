import { IConfigurationService } from '@/config/configuration.service.interface';
import type { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  CreateKeyCommand,
  DecryptCommand,
  EncryptCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class AwsEncryptionApiService implements IEncryptionApi, OnModuleInit {
  private readonly kmsClient: KMSClient;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.kmsClient = new KMSClient({
      endpoint: 'http://localhost:4566',
      region: 'us-west-2',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });
  }

  async onModuleInit(): Promise<void> {
    const command = new CreateKeyCommand({
      Description: 'Test key for LocalStack',
    });
    const response = await this.kmsClient.send(command);
    this.loggingService.info(`Created Key: ${response.KeyMetadata?.KeyId}`);

    const encryptedData = await this.kmsClient.send(
      new EncryptCommand({
        KeyId: response.KeyMetadata?.KeyId,
        Plaintext: Buffer.from('testData'),
      }),
    );
    this.loggingService.info(`Encrypted Data: ${encryptedData.CiphertextBlob}`);

    const decryptedData = await this.kmsClient.send(
      new DecryptCommand({ CiphertextBlob: encryptedData.CiphertextBlob }),
    );
    const decryptedString = decryptedData.Plaintext
      ? Buffer.from(decryptedData.Plaintext).toString('utf-8')
      : '';
    this.loggingService.info(`Decrypted Data: ${decryptedString}`);
  }

  encrypt(data: string): Promise<string> {
    this.loggingService.info(`Encrypting data: ${data}`);
    throw new Error('Method not implemented.');
  }

  decrypt(data: string): Promise<string> {
    this.loggingService.info(`Encrypting data: ${data}`);
    throw new Error('Method not implemented.');
  }
}
