// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { BillingAuthService } from '@/modules/billing/domain/billing-auth.service';
import { BillingController } from '@/modules/billing/routes/billing.controller';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';

@Module({
  imports: [JwtModule],
  controllers: [BillingController],
  providers: [BillingAuthService, BillingWebhookAuthGuard],
})
export class BillingModule {}
