import { IConfigurationService } from '@/config/configuration.service.interface';
import type { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import {
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class AwsEncryptionApiService implements IEncryptionApi {
  private readonly kmsClient: KMSClient;
  private readonly awsKmsKeyId: string | undefined;
  private readonly algorithm: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.awsKmsKeyId = this.configurationService.get<string>(
      'accounts.encryption.awsKms.keyId',
    );
    this.algorithm = this.configurationService.getOrThrow<string>(
      'accounts.encryption.awsKms.algorithm',
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

  async encryptBlob(data: unknown): Promise<{
    encryptedData: Buffer;
    encryptedDataKey: Buffer;
    iv: Buffer;
  }> {
    const dataKeyResponse = await this.kmsClient.send(
      new GenerateDataKeyCommand({
        KeyId: this.awsKmsKeyId,
        KeySpec: 'AES_256',
      }),
    );
    if (!dataKeyResponse.Plaintext || !dataKeyResponse.CiphertextBlob) {
      throw new Error('Failed to generate data key');
    }
    const iv = crypto.randomBytes(16); // Generate a new IV for each encryption
    const cipher = crypto.createCipheriv(
      this.algorithm,
      dataKeyResponse.Plaintext,
      iv,
    );
    const encryptedData = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final(),
    ]);
    return {
      encryptedData: Buffer.from(encryptedData),
      encryptedDataKey: Buffer.from(dataKeyResponse.CiphertextBlob),
      iv,
    };
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

  async decryptBlob(data: {
    encryptedData: Buffer;
    encryptedDataKey: Buffer;
    iv: Buffer;
  }): Promise<unknown> {
    const decryptedDataKey = await this.kmsClient.send(
      new DecryptCommand({ CiphertextBlob: data.encryptedDataKey }),
    );
    if (!decryptedDataKey.Plaintext) {
      throw new Error('Failed to decrypt data key');
    }
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      decryptedDataKey.Plaintext,
      data.iv,
    );
    let decrypted = decipher.update(data.encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }
}
