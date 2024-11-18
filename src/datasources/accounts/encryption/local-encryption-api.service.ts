import { IConfigurationService } from '@/config/configuration.service.interface';
import { EncryptedBlob } from '@/datasources/accounts/encryption/entities/encrypted-blob.entity';
import type { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv } from 'crypto';

@Injectable()
export class LocalEncryptionApiService implements IEncryptionApi {
  private readonly isProduction: boolean;
  private readonly algorithm: string;
  private readonly key: Buffer;
  private readonly iv: Buffer;

  constructor(private readonly configurationService: IConfigurationService) {
    this.isProduction = this.configurationService.getOrThrow<boolean>(
      'application.isProduction',
    );
    this.algorithm = this.configurationService.getOrThrow<string>(
      'accounts.encryption.local.algorithm',
    );
    this.key = Buffer.from(
      this.configurationService.getOrThrow<string>(
        'accounts.encryption.local.key',
      ),
      'hex',
    );
    this.iv = Buffer.from(
      this.configurationService.getOrThrow<string>(
        'accounts.encryption.local.iv',
      ),
      'hex',
    );
  }

  async encrypt(data: string): Promise<string> {
    if (this.isProduction) {
      throw new Error('Local encryption is not suitable for production usage');
    }
    const cipher = createCipheriv(this.algorithm, this.key, this.iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return Promise.resolve(encrypted);
  }

  async decrypt(data: string): Promise<string> {
    if (this.isProduction) {
      throw new Error('Local encryption is not suitable for production usage');
    }
    const decipher = createDecipheriv(this.algorithm, this.key, this.iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return Promise.resolve(decrypted);
  }

  async encryptBlob(data: unknown): Promise<EncryptedBlob> {
    if (this.isProduction) {
      throw new Error('Local encryption is not suitable for production usage');
    }
    if ((typeof data !== 'object' && !Array.isArray(data)) || data === null) {
      throw new Error('Data must be an object or array');
    }
    const encryptedData = Buffer.from(
      await this.encrypt(JSON.stringify(data)),
      'hex',
    );
    const encryptedDataKey = Buffer.from(
      await this.encrypt(this.key.toString('hex')),
      'hex',
    );
    return {
      encryptedData,
      encryptedDataKey,
      iv: this.iv,
    };
  }

  async decryptBlob<T>(encryptedBlob: EncryptedBlob): Promise<T> {
    if (this.isProduction) {
      throw new Error('Local encryption is not suitable for production usage');
    }
    const decryptedKey = await this.decrypt(
      encryptedBlob.encryptedDataKey.toString('hex'),
    );
    const decipher = createDecipheriv(
      this.algorithm,
      Buffer.from(decryptedKey, 'hex'),
      encryptedBlob.iv,
    );
    let decrypted = decipher.update(
      encryptedBlob.encryptedData.toString('hex'),
      'hex',
      'utf8',
    );
    decrypted += decipher.final('utf8');
    return Promise.resolve(JSON.parse(decrypted));
  }
}
