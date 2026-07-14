// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { BillingApiModule } from '@/datasources/billing-api/billing-api.module';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { BillingAuthService } from '@/modules/billing/domain/billing-auth.service';
import { BillingController } from '@/modules/billing/routes/billing.controller';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';

@Module({
  imports: [JwtModule, BillingApiModule],
  controllers: [BillingController],
  providers: [BillingAuthService, BillingWebhookAuthGuard],
})
export class BillingModule {}
