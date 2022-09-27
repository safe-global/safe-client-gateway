import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { IConfigurationService } from './configuration.service.interface';

@Injectable()
export class NestConfigurationService implements IConfigurationService {
  constructor(private readonly configService: NestConfigService) {}

  get<T>(key: string): T | undefined {
    return this.configService.get<T>(key);
  }

  getOrThrow<T>(key: string): T {
    return this.configService.getOrThrow<T>(key);
  }
}
