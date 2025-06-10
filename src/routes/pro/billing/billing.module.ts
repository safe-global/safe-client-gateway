import { Module } from '@nestjs/common';
import { BillingService } from '@/routes/pro/billing/billing.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [BillingService],
  exports:[BillingService]
})
export class BillingModule {}
