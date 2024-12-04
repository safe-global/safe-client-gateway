import { IConfigurationService } from '@/config/configuration.service.interface';
import { EncryptedBlob } from '@/datasources/accounts/encryption/entities/encrypted-blob.entity';
import type { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import {
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

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

  async decrypt(data: string): Promise<string> {
    const decryptedData = await this.kmsClient.send(
      new DecryptCommand({ CiphertextBlob: Buffer.from(data, 'base64') }),
    );
    if (!decryptedData.Plaintext) {
      throw new Error('Failed to decrypt data');
    }
    return Buffer.from(decryptedData.Plaintext).toString('utf8');
  }

  async encryptBlob<T>(data: T): Promise<EncryptedBlob> {
    if ((typeof data !== 'object' && !Array.isArray(data)) || data === null) {
      throw new Error('Data must be an object or array');
    }
    const { Plaintext, CiphertextBlob } = await this.kmsClient.send(
      new GenerateDataKeyCommand({
        KeyId: this.awsKmsKeyId,
        KeySpec: 'AES_256',
      }),
    );
    if (!Plaintext || !CiphertextBlob) {
      throw new Error('Failed to generate data key');
    }
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, Plaintext, iv);
    return {
      encryptedData: Buffer.concat([
        cipher.update(JSON.stringify(data), 'utf8'),
        cipher.final(),
      ]),
      encryptedDataKey: Buffer.from(CiphertextBlob),
      iv,
    };
  }

  async decryptBlob<T>(encryptedBlob: EncryptedBlob): Promise<T> {
    const { encryptedData, encryptedDataKey, iv } = encryptedBlob;
    const { Plaintext } = await this.kmsClient.send(
      new DecryptCommand({ CiphertextBlob: encryptedDataKey }),
    );
    if (!Plaintext) {
      throw new Error('Failed to decrypt data key');
    }
    const decipher = createDecipheriv(this.algorithm, Plaintext, iv);
    const decryptedData = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
    return JSON.parse(decryptedData.toString('utf8'));
  }
}
