// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { BillingApiModule } from '@/datasources/billing-api/billing-api.module';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { BillingAuthService } from '@/modules/billing/domain/billing-auth.service';
import { BillingController } from '@/modules/billing/routes/billing.controller';
import { BillingService } from '@/modules/billing/routes/billing.service';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';
import { EntitlementsRepositoryModule } from '@/modules/entitlements/domain/entitlements-repository.module';
import { SubscriptionSyncModule } from '@/modules/entitlements/subscription-sync.module';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    JwtModule,
    BillingApiModule,
    SubscriptionSyncModule,
    EntitlementsRepositoryModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    forwardRef(() => SpacesModule),
  ],
  controllers: [BillingController],
  providers: [BillingAuthService, BillingService, BillingWebhookAuthGuard],
})
export class BillingModule {}
