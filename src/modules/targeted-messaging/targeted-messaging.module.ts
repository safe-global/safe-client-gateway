// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { TargetedMessagingDatasourceModule } from '@/modules/targeted-messaging/datasources/targeted-messaging.datasource.module';
import { TargetedMessagingRepository } from '@/modules/targeted-messaging/domain/targeted-messaging.repository';
import { ITargetedMessagingRepository } from '@/modules/targeted-messaging/domain/targeted-messaging.repository.interface';
import { TargetedMessagingController } from '@/modules/targeted-messaging/routes/targeted-messaging.controller';
import { TargetedMessagingService } from '@/modules/targeted-messaging/routes/targeted-messaging.service';

@Module({
  imports: [TargetedMessagingDatasourceModule, SafeRepositoryModule],
  controllers: [TargetedMessagingController],
  providers: [
    {
      provide: ITargetedMessagingRepository,
      useClass: TargetedMessagingRepository,
    },
    TargetedMessagingService,
  ],
  exports: [ITargetedMessagingRepository],
})
export class TargetedMessagingModule {}
