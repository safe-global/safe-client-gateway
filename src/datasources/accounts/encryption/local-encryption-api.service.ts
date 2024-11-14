import { IConfigurationService } from '@/config/configuration.service.interface';
import type { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

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
    const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return Promise.resolve(encrypted);
  }

  async decrypt(data: string): Promise<string> {
    if (this.isProduction) {
      throw new Error('Local encryption is not suitable for production usage');
    }
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, this.iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return Promise.resolve(decrypted);
  }
}
