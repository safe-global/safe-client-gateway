// SPDX-License-Identifier: FSL-1.1-MIT
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { Injectable } from '@nestjs/common';
import type { ConfigService as NestConfigService } from '@nestjs/config';

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
