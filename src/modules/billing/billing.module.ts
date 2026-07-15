// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { BillingApiModule } from '@/datasources/billing-api/billing-api.module';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { BillingAuthService } from '@/modules/billing/domain/billing-auth.service';
import { BillingController } from '@/modules/billing/routes/billing.controller';
import { BillingWebhookService } from '@/modules/billing/routes/billing-webhook.service';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';

@Module({
  imports: [JwtModule, BillingApiModule, SpacesModule, SubscriptionsModule],
  controllers: [BillingController],
  providers: [
    BillingAuthService,
    BillingWebhookAuthGuard,
    BillingWebhookService,
  ],
})
export class BillingModule {}
