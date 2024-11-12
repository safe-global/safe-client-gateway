import { IConfigurationService } from '@/config/configuration.service.interface';
import type { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AwsEncryptionApiService implements IEncryptionApi {
  private readonly kmsClient: KMSClient;
  private readonly awsKmsKeyId: string | undefined;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.awsKmsKeyId = this.configurationService.get<string>(
      'accounts.encryption.awsKms.keyId',
    );
    this.kmsClient = new KMSClient({});
  }

  async encrypt(data: string): Promise<string> {
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
    const decryptedData = await this.kmsClient.send(
      new DecryptCommand({ CiphertextBlob: Buffer.from(data, 'base64') }),
    );
    if (!decryptedData.Plaintext) {
      throw new Error('Failed to decrypt data');
    }
    return Buffer.from(decryptedData.Plaintext).toString('utf-8');
  }
}
