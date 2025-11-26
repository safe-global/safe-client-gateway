import { Module } from '@nestjs/common';
import { TargetedMessagingDatasourceModule } from '@/modules/targeted-messaging/datasources/targeted-messaging.datasource.module';
import { TargetedMessagingRepositoryModule } from '@/modules/targeted-messaging/domain/targeted-messaging.repository.interface';
import { TargetedMessagingModule as TargetedMessagingRoutesModule } from '@/modules/targeted-messaging/routes/targeted-messaging.module';

@Module({
  imports: [
    TargetedMessagingDatasourceModule,
    TargetedMessagingRepositoryModule,
    TargetedMessagingRoutesModule,
  ],
})
export class TargetedMessagingModule {}
