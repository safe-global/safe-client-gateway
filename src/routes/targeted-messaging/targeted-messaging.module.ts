import { TargetedMessagingRepositoryModule } from '@/domain/targeted-messaging/targeted-messaging.repository.interface';
import { TargetedMessagingController } from '@/routes/targeted-messaging/targeted-messaging.controller';
import { TargetedMessagingService } from '@/routes/targeted-messaging/targeted-messaging.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [TargetedMessagingController],
  imports: [TargetedMessagingRepositoryModule],
  providers: [TargetedMessagingService],
})
export class TargetedMessagingModule {}
