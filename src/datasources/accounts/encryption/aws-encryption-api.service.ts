import { fakeJson } from '@/__tests__/faker';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { EncryptedBlob } from '@/datasources/accounts/encryption/entities/encrypted-blob.entity';
import type { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import {
  CreateKeyCommand,
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class AwsEncryptionApiService implements IEncryptionApi, OnModuleInit {
  private readonly kmsClient: KMSClient;
  private awsKmsKeyId: string | undefined; // TODO: make readonly
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
    // TODO: LocalStack testing
    this.kmsClient = new KMSClient({
      region: 'us-east-1',
      endpoint: 'http://localhost:4566', // LocalStack
      credentials: {
        accessKeyId: 'test', // Dummy credentials for LocalStack
        secretAccessKey: 'test',
      },
    });
  }

  // TODO: LocalStack testing
  async onModuleInit(): Promise<void> {
    const data = JSON.parse(fakeJson());
    console.log('Data:', data);
    const key = await this.kmsClient.send(
      new CreateKeyCommand({
        Description: 'Test KMS Key for LocalStack',
        KeyUsage: 'ENCRYPT_DECRYPT', // Key can encrypt and decrypt
        CustomerMasterKeySpec: 'SYMMETRIC_DEFAULT', // Default symmetric key
      }),
    );
    this.awsKmsKeyId = key.KeyMetadata?.KeyId;
    const encrypted = await this.encryptBlob(data);
    console.log('Encrypted Data:', encrypted);
    const decrypted = await this.decryptBlob(encrypted);
    console.log('Decrypted Data:', decrypted);
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

  async encryptBlob(data: unknown): Promise<EncryptedBlob> {
    const { Plaintext, CiphertextBlob } = await this.kmsClient.send(
      new GenerateDataKeyCommand({
        KeyId: this.awsKmsKeyId,
        KeySpec: 'AES_256',
      }),
    );
    if (!Plaintext || !CiphertextBlob) {
      throw new Error('Failed to generate data key');
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, Plaintext, iv);
    return {
      encryptedData: Buffer.concat([
        cipher.update(JSON.stringify(data), 'utf8'),
        cipher.final(),
      ]),
      encryptedDataKey: Buffer.from(CiphertextBlob),
      iv,
    };
  }

  async decryptBlob(encryptedBlob: EncryptedBlob): Promise<unknown> {
    const { encryptedData, encryptedDataKey, iv } = encryptedBlob;
    const { Plaintext } = await this.kmsClient.send(
      new DecryptCommand({ CiphertextBlob: encryptedDataKey }),
    );
    if (!Plaintext) {
      throw new Error('Failed to decrypt data key');
    }
    const decipher = crypto.createDecipheriv(this.algorithm, Plaintext, iv);
    const decryptedData = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
    return JSON.parse(decryptedData.toString('utf8'));
  }
}
