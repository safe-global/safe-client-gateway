import { TargetedMessagingDatasourceModule } from '@/modules/targeted-messaging/datasources/targeted-messaging.datasource.module';
import { TargetedMessagingRepositoryModule } from '@/modules/targeted-messaging/domain/targeted-messaging.repository.interface';
import { TargetedMessagingController } from '@/modules/targeted-messaging/routes/targeted-messaging.controller';
import { TargetedMessagingService } from '@/modules/targeted-messaging/routes/targeted-messaging.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [TargetedMessagingController],
  imports: [
    TargetedMessagingRepositoryModule,
    TargetedMessagingDatasourceModule,
  ],
  providers: [TargetedMessagingService],
})
export class TargetedMessagingModule {}
