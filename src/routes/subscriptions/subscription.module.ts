import { Module } from '@nestjs/common';
import { SubscriptionDomainModule } from '@/domain/subscriptions/subscription.domain.module';
import { SubscriptionService } from '@/routes/subscriptions/subscription.service';
import { SubscriptionController } from '@/routes/subscriptions/subscription.controller';

@Module({
  imports: [SubscriptionDomainModule],
  providers: [SubscriptionService],
  controllers: [SubscriptionController],
})
export class SubscriptionControllerModule {}
