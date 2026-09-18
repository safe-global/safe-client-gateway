// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { SafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository';
import { ISafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository.interface';
import { SafeAppInfoMapper } from '@/modules/safe-apps/mappers/safe-app-info.mapper';
import { SafeAppsController } from '@/modules/safe-apps/routes/safe-apps.controller';
import { SafeAppsService } from '@/modules/safe-apps/routes/safe-apps.service';

@Module({
  imports: [ConfigApiModule],
  providers: [
    {
      provide: ISafeAppsRepository,
      useClass: SafeAppsRepository,
    },
    SafeAppInfoMapper,
    SafeAppsService,
  ],
  controllers: [SafeAppsController],
  exports: [ISafeAppsRepository, SafeAppInfoMapper],
})
export class SafeAppsModule {}
