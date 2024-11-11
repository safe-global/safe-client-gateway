import { IConfigurationService } from '@/config/configuration.service.interface';
import type { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import { ILoggingService } from '@/logging/logging.interface';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class LocalEncryptionApiService implements IEncryptionApi, OnModuleInit {
  constructor(
    private readonly configurationService: IConfigurationService,
    private readonly loggingService: ILoggingService,
  ) {}

  async onModuleInit(): Promise<void> {
    const encryptedData = await this.encrypt('testData');
    this.loggingService.info(`Encrypted Data: ${encryptedData}`);
  }

  async encrypt(data: string): Promise<string> {
    // TODO: implement
    this.loggingService.info(`Encrypting data: ${data}`);
    return Promise.resolve(data);
  }

  decrypt(data: string): Promise<string> {
    // TODO: implement
    this.loggingService.info(`Decrypting data: ${data}`);
    return Promise.resolve(data);
  }
}
